'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../../lib/api'
import { getAuthToken } from '../../../lib/auth'
import '../havan.css'

type Item = Record<string, any>
type Mode = 'today' | 'week' | 'month'
type CourseContent = { chapters: Item[]; chapterId: string; topics: Item[]; topicIds: string[] }
type SelectedTopic = { topic: Item; course: Item; chapter: Item }

const DAYS = [
  { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' }, { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' }, { id: 0, label: 'Sun' },
]

const list = async (path: string) => {
  const data = await apiFetch<any>(path)
  return data?.items ?? data ?? []
}

const minutesText = (minutes: number) => {
  const value = Math.max(0, Math.round(minutes))
  if (value < 60) return value + ' min'
  const h = Math.floor(value / 60)
  const m = value % 60
  return m ? h + 'h ' + m + 'm' : h + 'h'
}

const dateKey = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + d
}

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function topicWeight(item: SelectedTopic) {
  return Math.max(1, Number(item.topic.estimated_study_minutes || 60))
}

function allocate(topics: SelectedTopic[], totalMinutes: number) {
  if (!topics.length) return []

  const safeTotal = Math.max(5, Math.round(totalMinutes / 5) * 5)
  const totalWeight = topics.reduce((sum, item) => sum + topicWeight(item), 0)
  const units = Math.floor(safeTotal / 5)
  const minimumUnits = units >= topics.length * 2 ? 2 : units >= topics.length ? 1 : 0

  const rawUnits = topics.map((item) => (topicWeight(item) / totalWeight) * units)
  const baseUnits = rawUnits.map((value) => Math.max(minimumUnits, Math.floor(value)))
  let remainingUnits = units - baseUnits.reduce((sum, value) => sum + value, 0)

  const order = rawUnits
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)

  let cursor = 0
  while (remainingUnits > 0 && order.length) {
    baseUnits[order[cursor % order.length].index] += 1
    remainingUnits -= 1
    cursor += 1
  }

  while (remainingUnits < 0) {
    const removable = baseUnits
      .map((value, index) => ({ index, value }))
      .filter((item) => item.value > minimumUnits)
      .sort((a, b) => b.value - a.value)
    if (!removable.length) break
    baseUnits[removable[0].index] -= 1
    remainingUnits += 1
  }

  return topics.map((item, index) => ({
    ...item,
    minutes: baseUnits[index] * 5,
  }))
}

function allocateToday(topics: SelectedTopic[], courseHours: Record<string, number>) {
  const byCourse = new Map<string, SelectedTopic[]>()
  topics.forEach((item) => {
    const key = String(item.course.id)
    byCourse.set(key, [...(byCourse.get(key) ?? []), item])
  })
  return [...byCourse.entries()].flatMap(([courseId, items]) => {
    const hours = Number(courseHours[courseId] ?? 1)
    const courseMinutes = Math.max(5, Math.round((Number.isFinite(hours) ? hours : 1) * 60 / 5) * 5)
    return allocate(items, courseMinutes)
  })
}

function recommendationPoints(topic: Item, chapter: Item) {
  const raw = String(topic.important_points || chapter.important_points || '').trim()
  return raw.split(/\r?\n/).map((line) => line.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean)
}

export default function HavanPlannerPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('today')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contentLoading, setContentLoading] = useState(false)
  const [error, setError] = useState('')
  const [account, setAccount] = useState<Item | null>(null)
  const [profile, setProfile] = useState<Item | null>(null)
  const [courses, setCourses] = useState<Item[]>([])
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [activeCourseId, setActiveCourseId] = useState('')
  const [courseContent, setCourseContent] = useState<Record<string, CourseContent>>({})
  const [courseHours, setCourseHours] = useState<Record<string, number>>({})
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [hoursPerDay, setHoursPerDay] = useState<Record<number, number>>({ 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 3 })
  const [notice, setNotice] = useState('')

  async function loadCourseContent(id: string) {
    if (!id || courseContent[id]) return
    setContentLoading(true)
    try {
      const chapters = await list('/chapters?course_id=' + id + '&page=1&page_size=100')
      const first = chapters[0]
      const topics = first ? await list('/topics?chapter_id=' + first.id + '&page=1&page_size=100') : []
      setCourseContent((current) => ({
        ...current,
        [id]: { chapters, chapterId: first ? String(first.id) : '', topics, topicIds: [] },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load course content.')
    } finally {
      setContentLoading(false)
    }
  }

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace('/auth')
      return
    }
    const load = async () => {
      try {
        const me = await apiFetch<any>('/auth/me')
        setAccount(me)
        if (!me.student_profile_id) {
          router.replace('/student')
          return
        }
        const context = await apiFetch<any>('/students/profiles/' + me.student_profile_id + '/context')
        setProfile(context.profile)
        const courseIds = (context.courses ?? []).map((x: Item) => x.course_id)
        const allCourses = await list('/courses?stream_id=' + context.profile.stream_id + '&include_freshman=true&page=1&page_size=100')
        const selected = allCourses.filter((x: Item) => courseIds.includes(x.id))
        setCourses(selected)
        if (selected[0]) {
          const firstId = String(selected[0].id)
          setSelectedCourseIds([firstId])
          setActiveCourseId(firstId)
          await loadCourseContent(firstId)
        }
        const saved = window.localStorage.getItem('havan_new_planner_draft')
        if (saved) {
          const draft = JSON.parse(saved)
          if (draft.mode) setMode(draft.mode)
          if (Array.isArray(draft.studyDays)) setStudyDays(draft.studyDays)
          if (draft.hoursPerDay) setHoursPerDay(draft.hoursPerDay)
          if (draft.courseHours) setCourseHours(draft.courseHours)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your Havan planner.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const activeContent = courseContent[activeCourseId]
  const selectedTopics = useMemo<SelectedTopic[]>(
    () => selectedCourseIds.flatMap((id) => {
      const course = courses.find((x) => String(x.id) === id)
      const data = courseContent[id]
      if (!course || !data) return []
      const chapter = data.chapters.find((x) => String(x.id) === data.chapterId) ?? {}
      return data.topics
        .filter((topic) => data.topicIds.includes(String(topic.id)) && String(topic.status).toUpperCase() === 'ACTIVE')
        .map((topic) => ({ topic, course, chapter }))
    }),
    [selectedCourseIds, courses, courseContent],
  )

  const totalTodayMinutes = selectedCourseIds
    .filter((id) => selectedTopics.some((item) => String(item.course.id) === id))
    .reduce((sum, id) => sum + Number(courseHours[id] ?? 1) * 60, 0)
  const weeklyMinutes = studyDays.reduce((sum, day) => sum + Number(hoursPerDay[day] || 0) * 60, 0)

  async function toggleCourse(id: string) {
    if (selectedCourseIds.includes(id)) {
      const next = selectedCourseIds.filter((x) => x !== id)
      if (!next.length) return
      setSelectedCourseIds(next)
      if (activeCourseId === id) setActiveCourseId(next[0])
      return
    }
    setSelectedCourseIds([...selectedCourseIds, id])
    setActiveCourseId(id)
    await loadCourseContent(id)
  }

  async function changeChapter(chapterId: string) {
    if (!activeCourseId) return
    try {
      const topics = await list('/topics?chapter_id=' + chapterId + '&page=1&page_size=100')
      setCourseContent((current) => ({
        ...current,
        [activeCourseId]: { ...current[activeCourseId], chapterId, topics, topicIds: [] },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chapter topics.')
    }
  }

  function toggleTopic(id: string) {
    if (!activeCourseId || !activeContent) return
    const topicIds = activeContent.topicIds.includes(id)
      ? activeContent.topicIds.filter((x) => x !== id)
      : [...activeContent.topicIds, id]
    setCourseContent((current) => ({
      ...current,
      [activeCourseId]: { ...current[activeCourseId], topicIds },
    }))
  }

  function toggleDay(id: number) {
    setStudyDays((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
  }

  function saveDraft(nextMode = mode) {
    window.localStorage.setItem('havan_new_planner_draft', JSON.stringify({ mode: nextMode, studyDays, hoursPerDay, courseHours }))
  }

  async function buildPlan() {
    setSaving(true)
    setError('')
    setNotice('')
    if (!selectedTopics.length) {
      setError('Choose at least one topic before building your Havan plan.')
      setSaving(false)
      return
    }

    const now = new Date()
    const totalMinutes = mode === 'today' ? totalTodayMinutes : mode === 'week' ? weeklyMinutes : weeklyMinutes * 4
    const allocated = mode === 'today'
      ? allocateToday(selectedTopics, courseHours)
      : allocate(selectedTopics, totalMinutes || 60)
    const nextPlan: any[] = []

    if (mode === 'today') {
      allocated.forEach((item, index) => nextPlan.push({
        id: 'today-' + item.topic.id,
        date: dateKey(now),
        day: 'Today',
        courseId: item.course.id,
        topicId: item.topic.id,
        course: item.course.name,
        chapter: item.chapter.name,
        topic: item.topic.name,
        minutes: item.minutes,
        questions: null,
        importantPoints: recommendationPoints(item.topic, item.chapter),
        order: index,
      }))
    } else {
      const days = mode === 'week' ? 7 : 28
      const dates = Array.from({ length: days }, (_, i) => addDays(now, i))
      let cursor = 0
      for (const item of allocated) {
        let remaining = item.minutes
        while (remaining > 0 && cursor < dates.length) {
          while (cursor < dates.length && !studyDays.includes(dates[cursor].getDay())) cursor++
          if (cursor >= dates.length) break
          const day = dates[cursor]
          const capacity = Number(hoursPerDay[day.getDay()] || 0) * 60
          const used = nextPlan.filter((x) => x.date === dateKey(day)).reduce((sum, x) => sum + x.minutes, 0)
          const slot = Math.min(remaining, Math.max(0, capacity - used))
          if (slot > 0) {
            nextPlan.push({
              id: mode + '-' + item.topic.id + '-' + cursor,
              date: dateKey(day),
              day: day.toLocaleDateString(undefined, { weekday: 'long' }),
              courseId: item.course.id,
              topicId: item.topic.id,
              course: item.course.name,
              chapter: item.chapter.name,
              topic: item.topic.name,
              minutes: slot,
              questions: null,
              importantPoints: recommendationPoints(item.topic, item.chapter),
              order: nextPlan.length,
            })
            remaining -= slot
          }
          if (used + slot >= capacity || slot === 0) cursor++
        }
      }
    }

    window.sessionStorage.setItem('havan_built_plan', JSON.stringify({ mode, plan: nextPlan }))
    saveDraft()
    try {
      if (account?.student_profile_id) {
        await apiFetch('/havan-planner/students/' + account.student_profile_id + '/plans', {
          method: 'POST',
          body: JSON.stringify({
            mode,
            horizon_days: mode === 'today' ? 1 : mode === 'week' ? 7 : 28,
            study_days: studyDays,
            hours_per_day: hoursPerDay,
            total_minutes: nextPlan.reduce((sum, item) => sum + item.minutes, 0),
            tasks: nextPlan.map((item) => ({
              course_id: Number(item.courseId),
              topic_id: Number(item.topicId),
              planned_date: item.date,
              minutes: item.minutes,
            })),
          }),
        })
      }
      setNotice('Your Havan plan is organized and saved.')
    } catch (err) {
      setNotice('Your plan is ready on this device, but could not be saved to your account.')
      setError(err instanceof Error ? err.message : 'Could not save the Havan plan.')
    } finally {
      setSaving(false)
    }
    router.push('/student/havan/plan')
  }

  if (loading) return <main className="new-planner-shell"><div className="new-planner-loading">Preparing your Havan planner…</div></main>

  return (
    <main className="new-planner-shell">
      <header className="new-planner-header">
        <button className="havan-brand" onClick={() => router.push('/student')} aria-label="Back to Havan dashboard"><span>H</span><strong>havan</strong></button>
        <div className="header-user">{account?.name ?? profile?.name ?? 'Student'}</div>
      </header>

      <nav className="new-planner-nav" aria-label="Havan planner">
        {(['today', 'week', 'month'] as Mode[]).map((item) => (
          <button key={item} className={mode === item ? 'active' : ''} onClick={() => { setMode(item); saveDraft(item) }}>
            <b>{item === 'today' ? 'Today' : item === 'week' ? 'Week' : 'Month'}</b>
            <span>{item === 'today' ? '1 day' : item === 'week' ? '7 days' : 'Monthly'}</span>
          </button>
        ))}
      </nav>

      <section className="new-planner-hero">
        <span className="hero-kicker">NEW HAVAN PLANNER</span>
        <h1>Plan what <em>you</em> want to study.</h1>
        <p>Choose exactly what you want to study. Havan then divides your available time across the selected topics.</p>
      </section>

      {error && <div className="planner-alert error">{error}</div>}
      {notice && <div className="planner-alert success">{notice}</div>}

      <section className="planner-card">
        <div className="card-heading">
          <div><span className="section-kicker">01</span><h2>Choose your courses</h2></div>
          <span className="selection-count">{selectedCourseIds.length} courses</span>
        </div>
        <div className="course-picker">
          {courses.length === 0 ? <p className="empty-note">Your courses are not available yet. Havan needs at least one course before it can organize a plan.</p> : courses.map((course) => (
            <button key={course.id} className={'course-chip ' + (selectedCourseIds.includes(String(course.id)) ? 'selected' : '')} onClick={() => toggleCourse(String(course.id))}>
              <b>{course.code ?? 'COURSE'}</b><span>{course.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="planner-card">
        <div className="card-heading">
          <div><span className="section-kicker">02</span><h2>Choose chapters and topics</h2></div>
          <span className="selection-count">{selectedTopics.length} selected</span>
        </div>
        <div className="active-course-tabs">
          {selectedCourseIds.map((id) => {
            const course = courses.find((x) => String(x.id) === id)
            return <button key={id} className={activeCourseId === id ? 'active' : ''} onClick={() => setActiveCourseId(id)}>{course?.name ?? id}</button>
          })}
        </div>
        {contentLoading && <p className="empty-note">Loading course content…</p>}
        {activeContent && (
          <>
            <label>Chapter</label>
            <select value={activeContent.chapterId} onChange={(e) => changeChapter(e.target.value)}>
              {activeContent.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Chapter {chapter.order_index}: {chapter.name}</option>)}
            </select>
            <div className="topic-grid">
              {activeContent.topics.filter((x) => String(x.status).toUpperCase() === 'ACTIVE').map((topic) => (
                <button key={topic.id} className={'topic-choice ' + (activeContent.topicIds.includes(String(topic.id)) ? 'selected' : '')} onClick={() => toggleTopic(String(topic.id))}>
                  <span>{activeContent.topicIds.includes(String(topic.id)) ? '✓' : '+'}</span>
                  <strong>{topic.name}</strong>
                  <small>Typical study time: {minutesText(Number(topic.estimated_study_minutes || 60))}</small>
                </button>
              ))}
            </div>
            {!activeContent.topics.length && <p className="empty-note">No active topics are available for this chapter yet.</p>}
          </>
        )}
      </section>

      <section className="planner-card">
        <div className="card-heading"><div><span className="section-kicker">03</span><h2>{mode === 'today' ? 'Set course hours' : 'Set your study days'}</h2><p className="card-help">{mode === 'today' ? 'Choose how much time each selected course gets. Havan will divide that time across its selected topics.' : 'Choose the days you study and your available hours. Havan will divide that time across your selected topics.'}</p></div></div>
        {mode === 'today' ? (
          <div className="course-hours-list">
            {selectedCourseIds.map((id) => {
              const course = courses.find((x) => String(x.id) === id)
              return <div className="course-hour-row" key={id}>
                <div><strong>{course?.name}</strong><small>Time you want to spend on this course today</small></div>
                <div className="hour-input"><input type="number" min="0.5" max="12" step="0.5" value={courseHours[id] ?? 1} onChange={(e) => setCourseHours((x) => ({ ...x, [id]: Number(e.target.value) }))} /><span>hours</span></div>
              </div>
            })}
            <div className="capacity-line"><strong>{minutesText(totalTodayMinutes)}</strong><span>total selected study time</span></div>
          </div>
        ) : (
          <>
            <div className="day-grid">
              {DAYS.map((day) => <button key={day.id} className={studyDays.includes(day.id) ? 'day-button selected' : 'day-button'} onClick={() => toggleDay(day.id)}><b>{day.label}</b><span>{hoursPerDay[day.id] || 0}h</span></button>)}
            </div>
            <div className="daily-hours">
              {studyDays.map((day) => <label key={day}><span>{DAYS.find((x) => x.id === day)?.label}</span><input type="number" min="0.5" max="12" step="0.5" value={hoursPerDay[day] ?? 2} onChange={(e) => setHoursPerDay((x) => ({ ...x, [day]: Number(e.target.value) }))} /><small>hours</small></label>)}
            </div>
            <div className="capacity-line"><strong>{minutesText(weeklyMinutes)}</strong><span>available per 7-day cycle · {studyDays.length} study days</span></div>
          </>
        )}
      </section>

      <div className="plan-summary-note pre-build-summary">
        <b>{selectedTopics.length} topic{selectedTopics.length === 1 ? '' : 's'} selected</b>
        <span>{mode === 'today' ? minutesText(totalTodayMinutes) + ' today' : minutesText(weeklyMinutes) + ' per week'}</span>
      </div>

      <button className="build-button" disabled={saving || !selectedTopics.length} onClick={buildPlan}>{saving ? 'Organizing…' : 'Build my Havan ' + (mode === 'today' ? 'Today' : mode === 'week' ? 'Week' : 'Month')}</button>

      <div className="planner-next-note"><strong>Ready to build?</strong><span>Your organized plan will open on its own screen.</span></div>

      <footer className="new-planner-footer"><span>Havan Academy</span><span>Student-controlled planning</span><span>Mobile first</span></footer>
    </main>
  )
}
