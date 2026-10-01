'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api'
import './student.css'

type Item = Record<string, any>
type Collection = { items: Item[]; total: number }

const DAYS = [
  { id: 0, short: 'Sun', label: 'Sunday' },
  { id: 1, short: 'Mon', label: 'Monday' },
  { id: 2, short: 'Tue', label: 'Tuesday' },
  { id: 3, short: 'Wed', label: 'Wednesday' },
  { id: 4, short: 'Thu', label: 'Thursday' },
  { id: 5, short: 'Fri', label: 'Friday' },
  { id: 6, short: 'Sat', label: 'Saturday' },
]

const apiList = async (path: string) => (await apiFetch<Collection>(path)).items

function clientKey() {
  if (typeof window === 'undefined') return ''
  const existing = window.localStorage.getItem('havan_student_key')
  if (existing) return existing
  const key = `student-${crypto.randomUUID()}`
  window.localStorage.setItem('havan_student_key', key)
  return key
}

export default function StudentPage() {
  const [studentId, setStudentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<Item | null>(null)
  const [context, setContext] = useState<any>(null)

  const [universities, setUniversities] = useState<Item[]>([])
  const [curriculums, setCurriculums] = useState<Item[]>([])
  const [streams, setStreams] = useState<Item[]>([])
  const [courses, setCourses] = useState<Item[]>([])
  const [topics, setTopics] = useState<Item[]>([])

  const [draft, setDraft] = useState({
    name: '',
    universityId: '',
    curriculumId: '',
    streamId: '',
    courseIds: [] as string[],
    studyHours: 2,
    studyDays: [1, 2, 3, 4, 5],
  })

  const [examForm, setExamForm] = useState({ courseId: '', type: 'FINAL', date: '', importance: 3 })

  async function loadCurriculum(path: string, setter: (items: Item[]) => void) {
    setter(await apiList(path))
  }

  async function loadExisting() {
    setLoading(true)
    setError('')
    try {
      const key = clientKey()
      const existing = await apiFetch<Item>(`/students/profiles/by-client/${encodeURIComponent(key)}`)
      setStudentId(existing.id)
      setProfile(existing)
      await loadContext(existing.id)
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('404'))) {
        setError(err instanceof Error ? err.message : 'Could not load your study profile.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadContext(id: number) {
    const data = await apiFetch<any>(`/students/profiles/${id}/context`)
    setContext(data)
    setProfile(data.profile)
    setStudentId(id)
    await loadTopics(data.courses.map((item: Item) => item.course_id))
  }

  async function loadTopics(courseIds: number[]) {
    if (!courseIds.length) {
      setTopics([])
      return
    }
    const chapters = (await Promise.all(courseIds.map((id) => apiList(`/chapters?course_id=${id}&page=1&page_size=100`)))).flat()
    const topicGroups = await Promise.all(chapters.map((chapter) => apiList(`/topics?chapter_id=${chapter.id}&page=1&page_size=100`)))
    setTopics(topicGroups.flat())
  }

  useEffect(() => {
    loadExisting()
  }, [])

  useEffect(() => {
    if (step !== 0 || !draft.universityId) return
    loadCurriculum(`/curriculums?university_id=${draft.universityId}&page=1&page_size=100`, setCurriculums)
  }, [draft.universityId, step])

  useEffect(() => {
    if (step !== 0 || !draft.curriculumId) return
    loadCurriculum(`/streams?curriculum_id=${draft.curriculumId}&page=1&page_size=100`, setStreams)
  }, [draft.curriculumId, step])

  useEffect(() => {
    if (step !== 0 || !draft.streamId) return
    loadCurriculum(`/courses?stream_id=${draft.streamId}&page=1&page_size=100`, setCourses)
  }, [draft.streamId, step])

  useEffect(() => {
    if (step === 0 && !universities.length) {
      loadCurriculum('/universities?page=1&page_size=100', setUniversities).catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load universities.')
      )
    }
  }, [step])

  const selectedCourses = useMemo(
    () => courses.filter((course) => draft.courseIds.includes(String(course.id))),
    [courses, draft.courseIds],
  )

  const completedTopics = context?.progress?.filter((item: Item) => item.status === 'COMPLETED').length ?? 0
  const inProgressTopics = context?.progress?.filter((item: Item) => item.status === 'IN_PROGRESS').length ?? 0

  async function createProfile() {
    setSaving(true)
    setError('')
    try {
      const created = await apiFetch<Item>('/students/profiles', {
        method: 'POST',
        body: JSON.stringify({
          client_key: clientKey(),
          name: draft.name.trim(),
          university_id: Number(draft.universityId),
          curriculum_id: Number(draft.curriculumId),
          stream_id: Number(draft.streamId),
          study_hours_per_day: draft.studyHours,
          study_days: draft.studyDays,
        }),
      })
      for (const courseId of draft.courseIds) {
        await apiFetch(`/students/profiles/${created.id}/courses`, {
          method: 'POST',
          body: JSON.stringify({ course_id: Number(courseId), confidence: 3 }),
        })
      }
      setStudentId(created.id)
      await loadContext(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  async function updateProgress(topicId: number, status: string) {
    if (!studentId) return
    try {
      await apiFetch(`/students/profiles/${studentId}/progress/${topicId}`, {
        method: 'PUT',
        body: JSON.stringify({ status, confidence: 3 }),
      })
      await loadContext(studentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update topic progress.')
    }
  }

  async function addExam() {
    if (!studentId || !examForm.courseId || !examForm.date) return
    setSaving(true)
    try {
      await apiFetch(`/students/profiles/${studentId}/exams`, {
        method: 'POST',
        body: JSON.stringify({
          course_id: Number(examForm.courseId),
          exam_type: examForm.type,
          exam_date: examForm.date,
          importance: examForm.importance,
        }),
      })
      setExamForm({ courseId: '', type: 'FINAL', date: '', importance: 3 })
      await loadContext(studentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the exam.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="student-shell"><div className="student-loading">Loading your study space…</div></main>

  if (!studentId) {
    return (
      <main className="student-shell">
        <header className="student-brand"><span className="student-mark">H</span><strong>havan</strong><span>Study Planner</span></header>
        <section className="onboard">
          <div className="student-progress"><span className="active" /><span className={step > 0 ? 'active' : ''} /><span className={step > 1 ? 'active' : ''} /><span className={step > 2 ? 'active' : ''} /></div>

          {step === 0 && (
            <>
              <span className="student-eyebrow">YOUR STARTING POINT</span>
              <h1>Build your study space around your real curriculum.</h1>
              <p className="student-lead">Tell Havan who you are and where you study. Your choices become the academic context for everything that comes later.</p>
              <label>Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Your name" /></label>
              <label>University<select value={draft.universityId} onChange={(e) => setDraft({ ...draft, universityId: e.target.value, curriculumId: '', streamId: '', courseIds: [] })}><option value="">Select university</option>{universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
              <label>Curriculum<select disabled={!draft.universityId} value={draft.curriculumId} onChange={(e) => setDraft({ ...draft, curriculumId: e.target.value, streamId: '', courseIds: [] })}><option value="">Select curriculum</option>{curriculums.map((c) => <option key={c.id} value={c.id}>{c.name} · v{c.version}</option>)}</select></label>
              <label>Stream<select disabled={!draft.curriculumId} value={draft.streamId} onChange={(e) => setDraft({ ...draft, streamId: e.target.value, courseIds: [] })}><option value="">Select stream</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              {error && <div className="student-error">{error}</div>}
              <button className="student-primary" disabled={!draft.name.trim() || !draft.streamId} onClick={() => setStep(1)}>Continue</button>
            </>
          )}

          {step === 1 && (
            <>
              <span className="student-eyebrow">YOUR COURSES</span>
              <h1>Choose what you are actually studying.</h1>
              <p className="student-lead">Select the courses that belong to your current workload. Havan will use these as your planning scope.</p>
              <div className="course-pick-list">{courses.map((course) => {
                const selected = draft.courseIds.includes(String(course.id))
                return <button key={course.id} className={selected ? 'course-pick selected' : 'course-pick'} onClick={() => setDraft({ ...draft, courseIds: selected ? draft.courseIds.filter((id) => id !== String(course.id)) : [...draft.courseIds, String(course.id)] })}><span><b>{course.code}</b>{course.name}</span><i>{selected ? '✓' : '+'}</i></button>
              })}</div>
              <div className="student-actions"><button className="student-secondary" onClick={() => setStep(0)}>Back</button><button className="student-primary" disabled={!draft.courseIds.length} onClick={() => setStep(2)}>Continue</button></div>
            </>
          )}

          {step === 2 && (
            <>
              <span className="student-eyebrow">YOUR CAPACITY</span>
              <h1>How much time can you really give it?</h1>
              <p className="student-lead">This is availability, not a promise. The planner will use it as a boundary.</p>
              <label>Study hours per day<input type="number" min="0.5" max="12" step="0.5" value={draft.studyHours} onChange={(e) => setDraft({ ...draft, studyHours: Number(e.target.value) })} /></label>
              <span className="day-label">Normal study days</span>
              <div className="day-pick">{DAYS.map((day) => <button key={day.id} className={draft.studyDays.includes(day.id) ? 'day selected' : 'day'} onClick={() => setDraft({ ...draft, studyDays: draft.studyDays.includes(day.id) ? draft.studyDays.filter((id) => id !== day.id) : [...draft.studyDays, day.id] })}>{day.short}</button>)}</div>
              <div className="capacity"><b>{(draft.studyHours * draft.studyDays.length).toFixed(1)}h</b><span>available in a normal week</span></div>
              <div className="student-actions"><button className="student-secondary" onClick={() => setStep(1)}>Back</button><button className="student-primary" disabled={!draft.studyDays.length || saving} onClick={() => setStep(3)}>Continue</button></div>
            </>
          )}

          {step === 3 && (
            <>
              <span className="student-eyebrow">READY TO START</span>
              <h1>One profile. Then the work gets practical.</h1>
              <p className="student-lead">Havan will save your academic context. It will not create recommendations in this phase. That comes after the student data is trustworthy.</p>
              <div className="review-card"><b>{draft.name}</b><span>{universities.find((x) => String(x.id) === draft.universityId)?.name}</span><span>{streams.find((x) => String(x.id) === draft.streamId)?.name}</span><span>{selectedCourses.length} courses selected</span><span>{draft.studyHours}h/day · {draft.studyDays.length} days/week</span></div>
              {error && <div className="student-error">{error}</div>}
              <div className="student-actions"><button className="student-secondary" onClick={() => setStep(2)}>Back</button><button className="student-primary" disabled={saving} onClick={createProfile}>{saving ? 'Saving…' : 'Create my study space'}</button></div>
            </>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="student-shell dashboard-shell">
      <header className="student-topbar"><div className="student-brand"><span className="student-mark">H</span><strong>havan</strong><span>Study Planner</span></div><span className="student-context">{profile?.name} · {profile?.study_hours_per_day}h/day</span></header>
      {error && <div className="student-error top-error">{error}<button onClick={() => setError('')}>×</button></div>}
      <section className="dashboard-hero"><div><span className="student-eyebrow">YOUR ACADEMIC CONTEXT</span><h1>{profile?.name}, this is your starting point.</h1><p>{profile?.university_id ? universities.find((x) => x.id === profile.university_id)?.name ?? 'Your university' : 'Your university'} · {profile?.study_hours_per_day} hours per study day</p></div></section>

      <section className="stats"><article><b>{context?.courses?.length ?? 0}</b><span>courses</span></article><article><b>{topics.length}</b><span>topics in scope</span></article><article><b>{completedTopics}</b><span>topics complete</span></article><article><b>{context?.exams?.length ?? 0}</b><span>exam dates</span></article></section>

      <section className="dashboard-grid">
        <div className="panel"><div className="panel-heading"><div><span className="student-eyebrow">COURSE SCOPE</span><h2>Your courses</h2></div></div>{context?.courses?.map((sc: Item) => { const course = courses.find((c) => c.id === sc.course_id); return <div className="course-row" key={sc.id}><div><b>{course?.code ?? `Course #${sc.course_id}`}</b><span>{course?.name ?? 'Course'}</span></div><span className="confidence">Confidence {sc.confidence}/5</span></div> })}</div>

        <div className="panel"><div className="panel-heading"><div><span className="student-eyebrow">ASSESSMENTS</span><h2>Exam dates</h2></div></div>{context?.exams?.length ? context.exams.map((exam: Item) => { const course = courses.find((c) => c.id === exam.course_id); return <div className="exam-row" key={exam.id}><div><b>{course?.code ?? 'Course'}</b><span>{exam.exam_type}</span></div><strong>{exam.exam_date}</strong></div> }) : <p className="muted">No exam dates yet. Add the dates you already know.</p>}<div className="exam-form"><select value={examForm.courseId} onChange={(e) => setExamForm({ ...examForm, courseId: e.target.value })}><option value="">Course</option>{courses.filter((c) => context?.courses?.some((sc: Item) => sc.course_id === c.id)).map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</select><select value={examForm.type} onChange={(e) => setExamForm({ ...examForm, type: e.target.value })}><option>FINAL</option><option>MIDTERM</option><option>QUIZ</option></select><input type="date" value={examForm.date} onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}/><button disabled={saving || !examForm.courseId || !examForm.date} onClick={addExam}>Add</button></div></div>
      </section>

      <section className="panel progress-panel"><div className="panel-heading"><div><span className="student-eyebrow">TOPIC PROGRESS</span><h2>What you know</h2></div><span className="progress-summary">{completedTopics} complete · {inProgressTopics} in progress</span></div>{topics.slice(0, 30).map((topic) => { const p = context?.progress?.find((item: Item) => item.topic_id === topic.id); const status = p?.status ?? 'NOT_STARTED'; return <div className="topic-row" key={topic.id}><div><b>{topic.name}</b><span>{topic.estimated_study_minutes} min · difficulty {topic.difficulty}/5</span></div><button className={status === 'COMPLETED' ? 'progress-button complete' : status === 'IN_PROGRESS' ? 'progress-button active' : 'progress-button'} onClick={() => updateProgress(topic.id, status === 'NOT_STARTED' ? 'IN_PROGRESS' : status === 'IN_PROGRESS' ? 'COMPLETED' : 'NOT_STARTED')}>{status === 'NOT_STARTED' ? 'Start' : status === 'IN_PROGRESS' ? 'Complete' : 'Completed'}</button></div>})}</section>

      <p className="student-footer">Havan recommends later. For now, you define the academic context and keep control of your progress.</p>
    </main>
  )
}
