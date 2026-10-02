
'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import '../student.css'
import './planner.css'

type Item = Record<string, any>
type Task = Item & { estimated_minutes: number }

interface TopicProgress {
  topic_id: string | number
  completed_minutes?: number
  study_sessions?: number
  confidence?: number | string
}

const KEY = 'havan_student_key'

function getClientKey() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(KEY) || ''
}

function toDate(value: string) {
  return new Date(value + 'T00:00:00')
}

function dateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

function addDays(value: Date, amount: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + amount)
  return next
}

function today() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function formatDate(value: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options).format(value)
}

function minutesLabel(minutes: number) {
  if (minutes < 60) return minutes + ' min'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? hours + 'h ' + rest + 'm' : hours + 'h'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'H'
}

export default function PlannerPage() {
  const [studentId, setStudentId] = useState<number | null>(null)
  const [profile, setProfile] = useState<Item | null>(null)
  const [context, setContext] = useState<Item | null>(null)
  const [plan, setPlan] = useState<Item | null>(null)
  const [courses, setCourses] = useState<Item[]>([])
  const [topics, setTopics] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(dateKey(today()))
  const [courseFilter, setCourseFilter] = useState('ALL')
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [lastDecision, setLastDecision] = useState<{
    action: 'START' | 'COMPLETE' | 'SKIP' | 'MOVE' | 'RESCHEDULE' | 'ADD' | 'REPEAT'
    topicName: string
    summary: string
    impact: string
  } | null>(null)
  const [moveDate, setMoveDate] = useState('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [repeatDate, setRepeatDate] = useState('')
  const [addDate, setAddDate] = useState('')
  const [addTopicId, setAddTopicId] = useState('')
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null)
  const [focusSeconds, setFocusSeconds] = useState(25 * 60)
  const [focusMode, setFocusMode] = useState<'compact' | 'normal' | 'fullscreen' | 'minimized'>('normal')

  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  )
  const topicMap = useMemo(
    () => new Map(topics.map((topic) => [topic.id, topic])),
    [topics],
  )

  async function apiList(path: string) {
    const result = await apiFetch<Item>(path)
    return result.items ?? result
  }

  async function generatePlan(id: number) {
    setGenerating(true)
    setError('')
    try {
      const next = await apiFetch<Item>('/planner/students/' + id + '/generate', {
        method: 'POST',
        body: JSON.stringify({ horizon_days: 7 }),
      })
      setPlan(next)
      setSelectedDate(next.days?.[0]?.date ?? dateKey(today()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate your plan.')
    } finally {
      setGenerating(false)
    }
  }

  async function rebalancePlan(id: number) {
    setGenerating(true)
    setError('')
    try {
      const next = await apiFetch<Item>('/planner/students/' + id + '/replan', {
        method: 'POST',
        body: JSON.stringify({ horizon_days: 7 }),
      })
      setPlan(next)
      setSelectedDate(next.days?.[0]?.date ?? dateKey(today()))
      setToast('Your week was rebalanced using your current progress, decisions, and study capacity.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rebalance your study plan.')
    } finally {
      setGenerating(false)
    }
  }

  async function loadContext(id: number) {
    const data = await apiFetch<Item>('/students/profiles/' + id + '/context')
    const courseIds = (data.courses ?? []).map((course: Item) => course.course_id)
    const nextProfile = data.profile
    const courseItems = await apiList(
      '/courses?stream_id=' + nextProfile.stream_id + '&include_freshman=true&page=1&page_size=100',
    )
    const selected = courseItems.filter((course: Item) => courseIds.includes(course.id))
    const chapters = (
      await Promise.all(
        selected.map((course: Item) =>
          apiList('/chapters?course_id=' + course.id + '&page=1&page_size=100'),
        ),
      )
    ).flat()
    const topicItems = (
      await Promise.all(
        chapters.map((chapter: Item) =>
          apiList('/topics?chapter_id=' + chapter.id + '&page=1&page_size=100')
            .then((items: Item[]) => items.map((topic) => ({ ...topic, course_id: chapter.course_id }))),
        ),
      )
    ).flat()

    setStudentId(id)
    setProfile(nextProfile)
    setContext(data)
    setCourses(selected)
    setTopics(topicItems.filter((topic: Item) => String(topic.status).toUpperCase() === 'ACTIVE'))
    await generatePlan(id)
  }

  useEffect(() => {
    if (!focusTaskId) return
    if (focusSeconds <= 0) {
      setToast('Focus session complete. Nice. Your brain may now file a formal complaint about having to work.')
      return
    }
    const timer = window.setInterval(() => {
      setFocusSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [focusTaskId, focusSeconds])

  function formatFocusTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0')
  }

  async function actOnTask(task: Task, action: 'START' | 'COMPLETE' | 'SKIP' | 'MOVE' | 'RESCHEDULE' | 'REPEAT', targetDate?: string) {
    if (!studentId || actionBusy) return
    setActionBusy(true)
    setError('')
    try {
      const updatedPlan = await apiFetch<Item>('/planner/students/' + studentId + '/tasks/' + task.id + '/action', {
        method: 'POST',
        body: JSON.stringify({ action, target_date: targetDate || null }),
      })
      setPlan(updatedPlan)
      const latestProgress = await apiFetch<TopicProgress[]>('/students/profiles/' + studentId + '/progress')
      setContext((current) => current ? { ...current, progress: latestProgress } : current)
      const topicName = topicMap.get(task.topic_id)?.name ?? 'this topic'
      if (action === 'START') {
        setLastDecision({
          action,
          topicName,
          summary: `Havan started ${topicName} without changing your schedule.`,
          impact: 'The plan stays unchanged until you complete, skip, or move the session.',
        })
        setFocusTaskId(task.id)
        setFocusSeconds(25 * 60)
        setFocusMode('normal')
        setSelectedTaskId(null)
        setToast('Focus mode started. One session, one topic, no heroic promises required.')
      } else if (action === 'COMPLETE') {
        setLastDecision({
          action,
          topicName,
          summary: `You completed ${topicName}.`,
          impact: 'Havan recorded the progress and recalculated the remaining recommendations around what you finished.',
        })
        setFocusTaskId(null)
        setSelectedTaskId(null)
        setToast('Session completed. Havan recorded the progress and recalculated what comes next.')
      } else if (action === 'SKIP') {
        setLastDecision({
          action,
          topicName,
          summary: `You skipped ${topicName} for now.`,
          impact: 'Havan defers it so it does not immediately return on the first study day, then rebuilds the remaining capacity around your decision.',
        })
        setSelectedTaskId(null)
        setToast('Skipped and recorded. Havan rebuilt the remaining week around that decision.')
      } else if (action === 'RESCHEDULE') {
        const nextDate = targetDate || selectedDate
        setLastDecision({ action, topicName, summary: `You rescheduled ${topicName} to ${formatDate(toDate(nextDate), { weekday: 'long', month: 'long', day: 'numeric' })}.`, impact: 'Havan keeps the session inside the current plan horizon and checks the destination capacity before saving it.' })
        setSelectedDate(nextDate)
        setRescheduleDate('')
        setSelectedTaskId(null)
        setToast('Session rescheduled. Havan kept the rest of your plan intact.')
      } else if (action === 'REPEAT') {
        const nextDate = targetDate || selectedDate
        setLastDecision({ action, topicName, summary: `You scheduled another practice session for ${topicName}.`, impact: 'The original session remains part of your history. This creates a separate practice session on the date you chose.' })
        setSelectedDate(nextDate)
        setRepeatDate('')
        setSelectedTaskId(null)
        setToast('Practice session added to your plan.')
      } else {
        const nextDate = targetDate || updatedPlan.days?.[0]?.date || selectedDate
        setLastDecision({
          action,
          topicName,
          summary: `You moved ${topicName} to ${formatDate(toDate(nextDate), { weekday: 'long', month: 'long', day: 'numeric' })}.`,
          impact: 'Havan pins the session to that date and recalculates the remaining schedule around the new commitment.',
        })
        setSelectedDate(nextDate)
        setMoveDate('')
        setSelectedTaskId(null)
        setToast('Session moved. Havan rebuilt the remaining week around the new date.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this study session.')
    } finally {
      setActionBusy(false)
    }
  }


  async function addStudySession() {
    if (!studentId || actionBusy || !addTopicId || !addDate || !plan) return
    setActionBusy(true)
    setError('')
    try {
      const updatedPlan = await apiFetch<Item>('/planner/students/' + studentId + '/add', {
        method: 'POST',
        body: JSON.stringify({ action: 'ADD', target_date: addDate, target_topic_id: Number(addTopicId) }),
      })
      setPlan(updatedPlan)
      setSelectedDate(addDate)
      setAddTopicId('')
      setAddDate('')
      setToast('Study session added. Havan checked the destination capacity first.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this study session.')
    } finally {
      setActionBusy(false)
    }
  }

  useEffect(() => {
    const key = getClientKey()
    if (!key) {
      setError('Create your student profile first.')
      setLoading(false)
      return
    }

    apiFetch<Item>('/students/profiles/by-client/' + encodeURIComponent(key))
      .then((student) => loadContext(student.id))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your student profile.'))
      .finally(() => setLoading(false))
  }, [])

  const tasks: Task[] = plan?.tasks ?? []

  const visibleTasks = useMemo(
    () => tasks.filter((task) => courseFilter === 'ALL' || String(task.course_id) === courseFilter),
    [tasks, courseFilter],
  )

  const grouped = useMemo(() => {
    const result: Record<string, Task[]> = {}
    visibleTasks.forEach((task) => {
      result[task.planned_date] = result[task.planned_date] ?? []
      result[task.planned_date].push(task)
    })
    return result
  }, [visibleTasks])

  const planDates = useMemo(() => {
    const first = plan?.days?.[0]?.date ? toDate(plan.days[0].date) : today()
    return Array.from({ length: plan?.horizon_days ?? 7 }, (_, index) => addDays(first, index))
  }, [plan])

  const selectedDay = toDate(selectedDate)
  const selectedTasks = grouped[selectedDate] ?? []
  const totalMinutes = visibleTasks.reduce((sum, task) => sum + task.estimated_minutes, 0)
  const selectedMinutes = selectedTasks.reduce((sum, task) => sum + task.estimated_minutes, 0)
  const recommendedCount = visibleTasks.filter((task) => task.status === 'RECOMMENDED').length
  const completedCount = visibleTasks.filter((task) => task.status === 'COMPLETED').length

  const progressMap = useMemo<Map<string | number, TopicProgress>>(
    () => new Map<string | number, TopicProgress>(
      (context?.progress ?? []).map((item: TopicProgress) => [item.topic_id, item]),
    ),
    [context],
  )

  const academicProgress = useMemo(() => {
    const total = topics.reduce((sum, topic) => sum + Number(topic.estimated_study_minutes || 0), 0)
    const completed = topics.reduce((sum, topic) => {
      const progress = progressMap.get(topic.id)
      return sum + Math.min(Number(progress?.completed_minutes || 0), Number(topic.estimated_study_minutes || 0))
    }, 0)
    return {
      total,
      completed,
      percent: total ? Math.round((completed / total) * 100) : 0,
    }
  }, [topics, progressMap])

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : null
  const selectedTopic = selectedTask ? topicMap.get(selectedTask.topic_id) : null
  const selectedCourse = selectedTask ? courseMap.get(selectedTask.course_id) : null

  const selectedExam = useMemo(() => {
    if (!selectedTask) return null
    return (context?.exams ?? [])
      .filter((exam: Item) => exam.course_id === selectedTask.course_id)
      .map((exam: Item) => ({ ...exam, dateObject: toDate(exam.exam_date) }))
      .filter((exam: Item) => exam.dateObject >= today())
      .sort((a: Item, b: Item) => a.dateObject.getTime() - b.dateObject.getTime())[0] ?? null
  }, [context, selectedTask])

  const recommendationReasons = useMemo(() => {
    if (!selectedTask || !selectedTopic) return []

    const progress = progressMap.get(selectedTask.topic_id)
    const totalMinutes = Number(selectedTopic.estimated_study_minutes || 0)
    const completedMinutes = Math.min(Number(progress?.completed_minutes || 0), totalMinutes)
    const engineReasons = String(selectedTask.reason || '')
      .split(';')
      .map((reason) => reason.trim())
      .filter(Boolean)

    const reasons = [...engineReasons]

    if (completedMinutes > 0 && completedMinutes < totalMinutes) {
      reasons.push(
        `You have studied ${completedMinutes} of ${totalMinutes} minutes, so this session continues the remaining work.`,
      )
    }
    if (progress?.confidence && Number(progress.confidence) <= 2) {
      reasons.push(`Your recorded confidence is ${progress.confidence}/5, so Havan gives this topic additional attention.`)
    }
    reasons.push(
      `${selectedTask.estimated_minutes}-minute session fits inside the planner's available study capacity.`,
    )

    return Array.from(new Set(reasons))
  }, [selectedTask, selectedTopic, progressMap])

  const upcomingExam = useMemo(() => {
    const now = today()
    return (context?.exams ?? [])
      .map((exam: Item) => ({ ...exam, dateObject: toDate(exam.exam_date) }))
      .filter((exam: Item) => exam.dateObject >= now)
      .sort((a: Item, b: Item) => a.dateObject.getTime() - b.dateObject.getTime())[0]
  }, [context])

  const examDays = upcomingExam
    ? Math.max(0, Math.ceil((upcomingExam.dateObject.getTime() - today().getTime()) / 86400000))
    : null

  const examReadiness = useMemo(() => {
    const exams = (context?.exams ?? [])
      .map((exam: Item) => {
        const scopedTopics = topics.filter((topic) => topic.course_id === exam.course_id)
        const total = scopedTopics.reduce((sum, topic) => sum + Number(topic.estimated_study_minutes || 0), 0)
        const completed = scopedTopics.reduce((sum, topic) => {
          const progress = progressMap.get(topic.id)
          return sum + Math.min(Number(progress?.completed_minutes || 0), Number(topic.estimated_study_minutes || 0))
        }, 0)
        const days = Math.max(0, Math.ceil((toDate(exam.exam_date).getTime() - today().getTime()) / 86400000))
        return {
          ...exam,
          days,
          readiness: total ? Math.round((completed / total) * 100) : 0,
          remainingMinutes: Math.max(0, total - completed),
        }
      })
      .filter((exam: Item) => exam.days >= 0)
      .sort((a: Item, b: Item) => a.days - b.days || Number(b.importance) - Number(a.importance))
    return exams
  }, [context, topics, progressMap, topicMap])

  if (loading) {
    return (
      <main className="student-shell planner-shell">
        <div className="planner-loading" aria-label="Loading study plan">
          <div className="planner-skeleton skeleton-brand" />
          <div className="planner-skeleton skeleton-hero" />
          <div className="planner-skeleton skeleton-stats" />
          <div className="planner-skeleton skeleton-agenda" />
        </div>
      </main>
    )
  }

  return (
    <main className="student-shell planner-shell">
      <header className="student-topbar planner-topbar">
        <a className="student-brand" href="/student">
          <span className="student-mark">H</span>
          <strong>havan</strong>
          <span>Study Planner</span>
        </a>
        <nav className="planner-nav" aria-label="Student navigation">
          <a className="planner-dashboard-link" href="/student">Dashboard</a>
          <button
            type="button"
            className="planner-user planner-profile-button"
            onClick={() => window.location.href = '/student/settings'}
            aria-label="Open your Havan profile settings"
            title="Profile settings"
          >
            <span className="planner-avatar">{initials(profile?.name ?? '')}</span>
            <span>{profile?.name ?? 'Student'}</span>
          </button>
        </nav>
      </header>

      {lastDecision && (
        <section className="planner-decision-note panel" aria-live="polite">
          <div className="planner-decision-icon" aria-hidden="true">
            {lastDecision.action === 'COMPLETE' ? '✓' : lastDecision.action === 'SKIP' ? '↷' : lastDecision.action === 'MOVE' ? '→' : '▶'}
          </div>
          <div className="planner-decision-copy">
            <span className="student-eyebrow">HAVAN ADAPTATION</span>
            <strong>{lastDecision.summary}</strong>
            <p>{lastDecision.impact}</p>
          </div>
          <button type="button" className="planner-decision-close" aria-label="Dismiss adaptation notice" onClick={() => setLastDecision(null)}>×</button>
        </section>
      )}

      {error && (
        <div className="student-error planner-error" role="alert">
          <span>{error}</span>
          {studentId && (
            <button
              type="button"
              className="planner-error-action"
              disabled={generating}
              onClick={() => generatePlan(studentId)}
            >
              Try again
            </button>
          )}
        </div>
      )}

      <section className="planner-hero">
        <div>
          <span className="student-eyebrow planner-eyebrow">YOUR ACADEMIC WEEK</span>
          <h1>{profile?.name ? profile.name + "'s plan" : 'Your study plan'}</h1>
          <p>
            Havan turns your curriculum, progress, confidence, exam pressure, and available
            capacity into a focused sequence of recommendations.
          </p>
        </div>
        <div className="planner-hero-actions">
          <div className="planner-capacity">
            <strong>{profile?.study_hours_per_day ?? 0}h/day</strong>
            <small>available study capacity</small>
          </div>
          <div className="planner-hero-buttons">
            <button
              className="student-secondary planner-rebalance"
              type="button"
              disabled={generating || !studentId}
              onClick={() => studentId && rebalancePlan(studentId)}
            >
              {generating ? 'Rebalancing…' : 'Rebalance week'}
            </button>
            <button
              className="student-primary planner-regenerate"
              type="button"
              disabled={generating || !studentId}
              onClick={() => studentId && generatePlan(studentId)}
            >
              {generating ? 'Rebuilding…' : 'Refresh plan'}
            </button>
          </div>
        </div>
      </section>

      {plan && (
        <>
          <section className="planner-overview" aria-label="Plan overview">
            <article className="planner-stat planner-stat-primary">
              <span>THIS WEEK</span>
              <strong>{minutesLabel(totalMinutes)}</strong>
              <small>{visibleTasks.length} scheduled sessions</small>
            </article>
            <article className="planner-stat">
              <span>RECOMMENDED</span>
              <strong>{recommendedCount}</strong>
              <small>sessions in this view</small>
            </article>
            <article className="planner-stat">
              <span>COMPLETED</span>
              <strong>{completedCount}</strong>
              <small>already finished</small>
            </article>
            <article className="planner-stat planner-stat-progress">
              <span>ACADEMIC PROGRESS</span>
              <strong>{academicProgress.percent}%</strong>
              <small>{minutesLabel(academicProgress.completed)} studied of {minutesLabel(academicProgress.total)}</small>
            </article>
            <article className="planner-stat planner-stat-exam">
              <span>NEXT EXAM</span>
              <strong>{examDays === null ? 'Not set' : examDays === 0 ? 'Today' : examDays + 'd'}</strong>
              <small>
                {upcomingExam
                  ? (courseMap.get(upcomingExam.course_id)?.code ?? 'Course') + ' · ' + upcomingExam.exam_type
                  : 'Add exam dates from Dashboard'}
              </small>
            </article>
          </section>

          <section className="planner-workspace">
            <div className="planner-main-column">
              <section className="planner-calendar panel">
                <div className="planner-section-heading">
                  <div>
                    <span className="student-eyebrow">WEEK VIEW</span>
                    <h2>Choose a study day</h2>
                  </div>
                  <span className="planner-section-note">{plan.horizon_days} day recommendation</span>
                </div>

                <div className="planner-week-strip" role="tablist" aria-label="Study plan days">
                  {planDates.map((date) => {
                    const key = dateKey(date)
                    const dayTasks = grouped[key] ?? []
                    const minutes = dayTasks.reduce((sum, task) => sum + task.estimated_minutes, 0)
                    const active = key === selectedDate

                    return (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={'planner-week-day ' + (active ? 'is-active' : '')}
                        key={key}
                        onClick={() => {
                          setSelectedDate(key)
                          setSelectedTaskId(null)
                        }}
                      >
                        <span>{formatDate(date, { weekday: 'short' })}</span>
                        <strong>{date.getDate()}</strong>
                        <small>{dayTasks.length ? minutesLabel(minutes) : 'No study'}</small>
                        {dayTasks.length > 0 && <i aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="planner-today panel">
                <div className="planner-today-heading">
                  <div>
                    <span className="student-eyebrow">FOCUS</span>
                    <h2>{formatDate(selectedDay, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                    <p>
                      {selectedTasks.length
                        ? selectedTasks.length + ' ' + (selectedTasks.length === 1 ? 'session' : 'sessions') + ' · ' + minutesLabel(selectedMinutes)
                        : 'No sessions scheduled for this day.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="planner-today-button"
                    onClick={() => {
                      setSelectedDate(dateKey(today()))
                      setSelectedTaskId(null)
                    }}
                  >
                    Today
                  </button>
                </div>

                {selectedTasks.length ? (
                  <div className="planner-focus-stack">
                    {selectedTasks.map((task, index) => {
                      const topic = topicMap.get(task.topic_id)
                      const course = courseMap.get(task.course_id)
                      return (
                        <button
                          type="button"
                          className={'planner-focus-task ' + (index === 0 ? 'is-first' : '')}
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <span className="focus-number">{String(index + 1).padStart(2, '0')}</span>
                          <span className="focus-content">
                            <span className="focus-course">{course?.code ?? 'Course'}</span>
                            <strong>{topic?.name ?? 'Recommended topic'}</strong>
                            <small>{task.reason}</small>
                          </span>
                          <span className="focus-time">
                            {minutesLabel(task.estimated_minutes)}
                            <b>{index === 0 ? 'Start here' : 'Recommended'}</b>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="planner-day-empty">
                    <strong>No study sessions here.</strong>
                    <span>Choose another day or refresh the recommendation after changing your academic context.</span>
                  </div>
                )}
              </section>

              <section className="planner-agenda panel">
                <div className="planner-section-heading planner-agenda-heading">
                  <div>
                    <span className="student-eyebrow">DAILY AGENDA</span>
                    <h2>Recommendation details</h2>
                  </div>
                  <select
                    aria-label="Filter recommendations by course"
                    value={courseFilter}
                    onChange={(event) => setCourseFilter(event.target.value)}
                  >
                    <option value="ALL">All courses</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code ?? course.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="planner-agenda-list">
                  {selectedTasks.length ? (
                    selectedTasks.map((task) => {
                      const topic = topicMap.get(task.topic_id)
                      const course = courseMap.get(task.course_id)
                      return (
                        <button
                          type="button"
                          className="planner-agenda-item"
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <span className="agenda-time">{minutesLabel(task.estimated_minutes)}</span>
                          <span className="agenda-copy">
                            <span>{course?.code ?? 'Course'}</span>
                            <strong>{topic?.name ?? 'Recommended topic'}</strong>
                            <small>{task.reason}</small>
                          </span>
                          <span className="agenda-priority">P{Number(task.priority).toFixed(2)}</span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="planner-agenda-empty">No recommendations match this day and course filter.</div>
                  )}
                </div>
              </section>
            </div>

            <aside className="planner-side-column">
              <section className="planner-side-card panel">
                <span className="student-eyebrow">WHY THIS PLAN</span>
                <h2>Several signals shape every recommendation.</h2>
                <p>
                  Havan's deterministic planner uses the same academic signals that drive each
                  recommendation. This explanation layer makes those signals readable instead of
                  hiding the reasoning behind a black box.
                </p>
                <div className="planner-signal-list">
                  <span>Exam urgency</span>
                  <span>Academic importance</span>
                  <span>Senior difficulty</span>
                  <span>Student confidence</span>
                  <span>Prerequisite readiness</span>
                  <span>Available capacity</span>
                </div>
                <div className="planner-principle">
                  <strong>You stay in control.</strong>
                  <span>Phase 6.6 explains the planner's reasoning and makes the effect of your decisions visible.</span>
                </div>
              </section>

              {examReadiness.length > 0 && (
                <section className="planner-side-card planner-exam-card planner-exam-management panel">
                  <div className="planner-section-heading">
                    <div>
                      <span className="student-eyebrow">ASSESSMENT AHEAD</span>
                      <h2>Your exam pressure</h2>
                    </div>
                    <a href="/student">Manage</a>
                  </div>
                  <div className="planner-exam-list">
                    {examReadiness.slice(0, 3).map((exam: Item) => (
                      <article className="planner-exam-item" key={exam.id}>
                        <div className="planner-exam-item-top">
                          <div>
                            <strong>{courseMap.get(exam.course_id)?.code ?? 'Course'}</strong>
                            <span>{exam.exam_type} · Importance {exam.importance}/5</span>
                          </div>
                          <b className={exam.days <= 3 ? 'is-urgent' : exam.days <= 7 ? 'is-near' : ''}>
                            {exam.days === 0 ? 'Today' : exam.days + 'd'}
                          </b>
                        </div>
                        <div className="planner-exam-readiness">
                          <div><span>READINESS</span><strong>{exam.readiness}%</strong></div>
                          <div className="planner-exam-readiness-track"><span style={{ width: Math.min(100, exam.readiness) + '%' }} /></div>
                          <small>{minutesLabel(exam.remainingMinutes)} of study time remaining in this course scope</small>
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className="planner-exam-note">Exam urgency and importance are already feeding Havan's recommendation score. Readiness adds the progress context you can act on.</p>
                </section>
              )}

              <section className="planner-side-card planner-academic-card panel">
                <div className="planner-section-heading">
                  <div>
                    <span className="student-eyebrow">ACADEMIC SCOPE</span>
                    <h2>Your courses</h2>
                  </div>
                  <span>{courses.length}</span>
                </div>
                <div className="planner-course-list">
                  {courses.map((course) => (
                    <button
                      type="button"
                      key={course.id}
                      className={'planner-course-row ' + (courseFilter === String(course.id) ? 'is-active' : '')}
                      onClick={() =>
                        setCourseFilter(courseFilter === String(course.id) ? 'ALL' : String(course.id))
                      }
                    >
                      <span>
                        <strong>{course.code ?? 'Course'}</strong>
                        <small>{course.name}</small>
                      </span>
                      <b>{tasks.filter((task) => task.course_id === course.id).length}</b>
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </section>
        </>
      )}

      {!plan && !generating && !error && (
        <section className="planner-empty panel">
          <span className="student-eyebrow">PREPARING YOUR WEEK</span>
          <h2>Havan is calculating your recommendations.</h2>
          <p>Your academic context is ready. The planner will build sessions inside your available study capacity.</p>
        </section>
      )}

      {plan && !tasks.length && (
        <section className="planner-empty panel">
          <span className="student-eyebrow">NOTHING TO SCHEDULE</span>
          <h2>No unfinished topics are available.</h2>
          <p>Your selected topics may all be complete, or your courses may not yet have active academic topics.</p>
          <a className="planner-empty-link" href="/student">Review academic context</a>
        </section>
      )}

      {focusTaskId && (() => {
        const focusTask = tasks.find((task) => task.id === focusTaskId)
        const focusTopic = focusTask ? topicMap.get(focusTask.topic_id) : null
        const focusCourse = focusTask ? courseMap.get(focusTask.course_id) : null
        if (!focusTask) return null
        return (
          <div className="planner-focus-backdrop" role="presentation">
            {focusMode === 'minimized' ? (
              <section className="planner-focus-mini" role="dialog" aria-modal="false" aria-label="Minimized Havan focus session">
                <div>
                  <span className="planner-focus-mini-brand"><span className="student-mark">H</span> havan focus</span>
                  <strong>{focusTopic?.name ?? 'Study session'}</strong>
                  <small>{formatFocusTime(focusSeconds)} remaining</small>
                </div>
                <div className="planner-focus-mini-actions">
                  <button type="button" className="planner-focus-window-button" aria-label="Restore focus window" onClick={() => setFocusMode('normal')}>↗</button>
                  <button type="button" className="planner-focus-window-button planner-focus-window-close" aria-label="Close focus mode" onClick={() => setFocusTaskId(null)}>×</button>
                </div>
              </section>
            ) : (
              <section className={'planner-focus-mode planner-focus-mode-' + focusMode} role="dialog" aria-modal="true" aria-labelledby="focus-mode-title">
                <div className="planner-focus-window-bar">
                  <span className="planner-focus-brand"><span className="student-mark">H</span><strong>havan</strong><small>FOCUS</small></span>
                  <div className="planner-focus-window-controls" aria-label="Focus window controls">
                    <button type="button" className="planner-focus-window-button" aria-label="Minimize focus mode" onClick={() => setFocusMode('minimized')}>−</button>
                    <button type="button" className="planner-focus-window-button" aria-label={focusMode === 'compact' ? 'Resize focus window to normal' : 'Resize focus window to compact'} onClick={() => setFocusMode(focusMode === 'compact' ? 'normal' : 'compact')}>□</button>
                    <button type="button" className="planner-focus-window-button" aria-label="Use full screen focus mode" onClick={() => setFocusMode('fullscreen')}>⛶</button>
                    <button type="button" className="planner-focus-window-button planner-focus-window-close" aria-label="Close focus mode" onClick={() => setFocusTaskId(null)}>×</button>
                  </div>
                </div>
                <div className="planner-focus-body">
                  <span className="student-eyebrow">FOCUS MODE · 25 MINUTES</span>
                  <span className="planner-focus-course">{focusCourse?.code ?? 'COURSE'}</span>
                  <h2 id="focus-mode-title">{focusTopic?.name ?? 'Study session'}</h2>
                  <p>{focusTask.reason}</p>
                  <div className="planner-focus-timer" aria-live="polite">{formatFocusTime(focusSeconds)}</div>
                  <div className="planner-focus-progress">
                    <span style={{ width: Math.max(0, Math.min(100, ((25 * 60 - focusSeconds) / (25 * 60)) * 100)) + '%' }} />
                  </div>
                  <div className="planner-focus-actions">
                    <button type="button" className="student-secondary" disabled={actionBusy} onClick={() => setFocusTaskId(null)}>Pause & close</button>
                    <button type="button" className="student-primary" disabled={actionBusy} onClick={() => actOnTask(focusTask, 'COMPLETE')}>Complete session</button>
                  </div>
                  <small>Havan records your progress. It does not grade how you studied.</small>
                </div>
              </section>
            )}
          </div>
        )
      })()}

      {selectedTask && (
        <div className="planner-detail-backdrop" role="presentation" onClick={() => setSelectedTaskId(null)}>
          <section
            className="planner-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="planner-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="planner-detail-handle" aria-hidden="true" />
            <div className="planner-detail-header">
              <div>
                <span className="student-eyebrow">YOUR NEXT MOVE</span>
                <h2 id="planner-detail-title">{selectedTopic?.name ?? 'Recommended topic'}</h2>
              </div>
              <button
                type="button"
                className="planner-detail-close"
                aria-label="Close recommendation details"
                onClick={() => setSelectedTaskId(null)}
              >
                ×
              </button>
            </div>

            <div className="planner-detail-meta">
              <span>{selectedCourse?.code ?? 'Course'}</span>
              <strong>{minutesLabel(selectedTask.estimated_minutes)}</strong>
              <span>Priority {Number(selectedTask.priority).toFixed(2)}</span>
            </div>

            <div className="planner-detail-reason">
              <span className="student-eyebrow">WHY HAVAN RECOMMENDS IT</span>
              <p>{selectedTask.reason || 'Havan selected this session from the current academic context and available capacity.'}</p>
              {recommendationReasons.length > 0 && (
                <ul className="planner-reason-list">
                  {recommendationReasons.map((reason, index) => (
                    <li key={index}>
                      <span aria-hidden="true">✓</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="planner-progress-meter">
              <div className="planner-progress-meter-heading">
                <span>TOPIC PROGRESS</span>
                <strong>{Math.min(100, Math.round(((progressMap.get(selectedTask.topic_id)?.completed_minutes || 0) / Number(selectedTopic?.estimated_study_minutes || 1)) * 100))}%</strong>
              </div>
              <div className="planner-progress-track" aria-label="Topic progress">
                <span style={{ width: Math.min(100, Math.round(((progressMap.get(selectedTask.topic_id)?.completed_minutes || 0) / Number(selectedTopic?.estimated_study_minutes || 1)) * 100)) + '%' }} />
              </div>
              <small>
                {minutesLabel(progressMap.get(selectedTask.topic_id)?.completed_minutes || 0)} studied · {progressMap.get(selectedTask.topic_id)?.study_sessions || 0} session(s)
              </small>
            </div>

            <div className="planner-detail-grid">
              <div>
                <span>Senior difficulty</span>
                <strong>{selectedTopic?.difficulty ?? '—'}/5</strong>
              </div>
              <div>
                <span>Planned for</span>
                <strong>{formatDate(toDate(selectedTask.planned_date), { month: 'short', day: 'numeric' })}</strong>
              </div>
              <div>
                <span>Exam importance</span>
                <strong>
                  {selectedTopic?.exam_importance
                    ? Math.round(Number(selectedTopic.exam_importance) * 100) + '%'
                    : '—'}
                </strong>
              </div>
              <div>
                <span>Plan status</span>
                <strong>{selectedTask.status}</strong>
              </div>
            </div>

            <div className="planner-action-preview">
              <span className="student-eyebrow">BEFORE YOU CHANGE IT</span>
              <p>
                Havan will record the action exactly as you choose. Moving changes only this session;
                completing updates your topic progress; skipping records that you intentionally did not study it today.
              </p>
            </div>


            <div className="planner-action-grid">
              <button type="button" className="planner-action planner-action-primary" disabled={actionBusy || selectedTask.status === 'COMPLETED'} onClick={() => actOnTask(selectedTask, 'START')}>
                <strong>Start focus</strong><span>25-minute study session</span>
              </button>
              <button type="button" className="planner-action" disabled={actionBusy || selectedTask.status === 'COMPLETED'} onClick={() => actOnTask(selectedTask, 'COMPLETE')}>
                <strong>Complete</strong><span>Record this session as finished</span>
              </button>
              <button type="button" className="planner-action" disabled={actionBusy || selectedTask.status === 'COMPLETED'} onClick={() => actOnTask(selectedTask, 'SKIP')}>
                <strong>Skip today</strong><span>Record the decision and adapt the week</span>
              </button>
            </div>

            <div className="planner-action-stack">
              <div className="planner-move-row">
                <div><span className="student-eyebrow">MOVE SESSION</span><p>Move this session to another date inside the current plan horizon.</p></div>
                <div className="planner-move-controls"><input type="date" min={dateKey(today())} value={moveDate} onChange={(event) => setMoveDate(event.target.value)} aria-label="Move study date" /><button type="button" className="student-secondary" disabled={actionBusy || !moveDate || selectedTask.status === 'COMPLETED'} onClick={() => actOnTask(selectedTask, 'MOVE', moveDate)}>Move</button></div>
              </div>
              <div className="planner-move-row">
                <div><span className="student-eyebrow">RESCHEDULE SESSION</span><p>Reschedule explicitly when you want Havan to record that change as a planning decision.</p></div>
                <div className="planner-move-controls"><input type="date" min={dateKey(today())} value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} aria-label="Reschedule study date" /><button type="button" className="student-secondary" disabled={actionBusy || !rescheduleDate || selectedTask.status === 'COMPLETED'} onClick={() => actOnTask(selectedTask, 'RESCHEDULE', rescheduleDate)}>Reschedule</button></div>
              </div>
              {(selectedTask.status === 'COMPLETED' || selectedTask.status === 'SKIPPED') && (
                <div className="planner-move-row">
                  <div><span className="student-eyebrow">REPEAT PRACTICE</span><p>Create a separate practice session without rewriting the original record.</p></div>
                  <div className="planner-move-controls"><input type="date" min={dateKey(today())} value={repeatDate} onChange={(event) => setRepeatDate(event.target.value)} aria-label="Repeat practice date" /><button type="button" className="student-secondary" disabled={actionBusy || !repeatDate} onClick={() => actOnTask(selectedTask, 'REPEAT', repeatDate)}>Repeat</button></div>
                </div>
              )}
            </div>

            <div className="planner-add-panel">
              <div><span className="student-eyebrow">ADD A SESSION</span><p>Add another active topic to this week's plan. Havan checks curriculum membership and available capacity first.</p></div>
              <div className="planner-add-controls">
                <select value={addTopicId} onChange={(event) => setAddTopicId(event.target.value)} aria-label="Topic to add">
                  <option value="">Choose an active topic…</option>
                  {topics.filter((topic) => !tasks.some((task) => task.topic_id === topic.id && !['SKIPPED','REPLANNED'].includes(task.status))).map((topic) => (
                    <option key={topic.id} value={topic.id}>{courseMap.get(topic.course_id)?.code ?? 'Course'} · {topic.name}</option>
                  ))}
                </select>
                <input type="date" min={dateKey(today())} value={addDate} onChange={(event) => setAddDate(event.target.value)} aria-label="Added session date" />
                <button type="button" className="student-primary" disabled={actionBusy || !addTopicId || !addDate} onClick={addStudySession}>Add session</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className="planner-toast" role="status">
          <span>{toast}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}>×</button>
        </div>
      )}

      <p className="student-footer">Havan recommends. You decide what actually happens.</p>
    </main>
  )
}
