'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api'
import './student.css'

type Item = Record<string, any>
type Collection = { items: Item[]; total: number }

const DAYS = [
  { id: 0, short: 'Sun' },
  { id: 1, short: 'Mon' },
  { id: 2, short: 'Tue' },
  { id: 3, short: 'Wed' },
  { id: 4, short: 'Thu' },
  { id: 5, short: 'Fri' },
  { id: 6, short: 'Sat' },
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

function initials(name: string): string {
  const letters = name.trim().split(/\\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return letters || 'ST'
}

export default function StudentPage() {
  const [studentId, setStudentId] = useState<number | null>(null)
  const [profile, setProfile] = useState<Item | null>(null)
  const [context, setContext] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)

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
    confidence: {} as Record<string, number>,
    studyHours: 2,
    studyDays: [1, 2, 3, 4, 5],
  })

  const [draftExams, setDraftExams] = useState<Array<{
    courseId: string
    type: string
    date: string
    importance: number
  }>>([])

  const [examForm, setExamForm] = useState({
    courseId: '',
    type: 'FINAL',
    date: '',
    importance: 4,
  })
  const [editingExamId, setEditingExamId] = useState<number | null>(null)

  async function loadContext(id: number) {
    const data = await apiFetch<Item>(`/students/profiles/${id}/context`)
    setContext(data)
    setProfile(data.profile)
    setStudentId(id)

    const courseItems = await apiList(
      `/courses?stream_id=${data.profile.stream_id}&page=1&page_size=100`,
    )
    const selected = courseItems.filter((course: Item) =>
      (data.courses ?? []).some((item: Item) => item.course_id === course.id),
    )
    setCourses(selected)

    const chapters = (
      await Promise.all(
        selected.map((course: Item) =>
          apiList(`/chapters?course_id=${course.id}&page=1&page_size=100`),
        ),
      )
    ).flat()

    const topicItems = (
      await Promise.all(
        chapters.map((chapter: Item) =>
          apiList(`/topics?chapter_id=${chapter.id}&page=1&page_size=100`),
        ),
      )
    ).flat()

    setTopics(topicItems.filter((topic: Item) => String(topic.status).toUpperCase() === 'ACTIVE'))
  }

  useEffect(() => {
    const run = async () => {
      try {
        const existing = await apiFetch<Item>(
          `/students/profiles/by-client/${encodeURIComponent(clientKey())}`,
        )
        await loadContext(existing.id)
      } catch (err) {
        if (!(err instanceof Error && err.message.includes('404'))) {
          setError(err instanceof Error ? err.message : 'Could not load your study space.')
        }
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  useEffect(() => {
    if (step === 0 && !universities.length) {
      apiList('/universities?page=1&page_size=100')
        .then(setUniversities)
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not load universities.'))
    }
  }, [step, universities.length])

  useEffect(() => {
    if (!draft.universityId) {
      setCurriculums([])
      return
    }
    apiList(
      `/curriculums?university_id=${draft.universityId}&page=1&page_size=100`,
    ).then(setCurriculums).catch((err) => setError(err instanceof Error ? err.message : 'Could not load curricula.'))
  }, [draft.universityId])

  useEffect(() => {
    if (!draft.curriculumId) {
      setStreams([])
      return
    }
    apiList(
      `/streams?curriculum_id=${draft.curriculumId}&page=1&page_size=100`,
    ).then(setStreams).catch((err) => setError(err instanceof Error ? err.message : 'Could not load streams.'))
  }, [draft.curriculumId])

  useEffect(() => {
    if (!draft.streamId) {
      setCourses([])
      return
    }
    apiList(
      `/courses?stream_id=${draft.streamId}&page=1&page_size=100`,
    ).then(setCourses).catch((err) => setError(err instanceof Error ? err.message : 'Could not load courses.'))
  }, [draft.streamId])

  const selectedCourses = useMemo(
    () => courses.filter((course) => draft.courseIds.includes(String(course.id))),
    [courses, draft.courseIds],
  )

  const completedTopics =
    context?.progress?.filter((item: Item) => item.status === 'COMPLETED').length ?? 0
  const inProgressTopics =
    context?.progress?.filter((item: Item) => item.status === 'IN_PROGRESS').length ?? 0
  const courseTopicStatus: Item[] = context?.course_topic_status ?? []
  const coursesWithoutTopics = courseTopicStatus.filter((item: Item) => item.active_topic_count === 0)
  const hasRegisteredTopics = courseTopicStatus.some((item: Item) => item.active_topic_count > 0)

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
          body: JSON.stringify({
            course_id: Number(courseId),
            confidence: draft.confidence[courseId] ?? 3,
          }),
        })
      }

      for (const exam of draftExams) {
        await apiFetch(`/students/profiles/${created.id}/exams`, {
          method: 'POST',
          body: JSON.stringify({
            course_id: Number(exam.courseId),
            exam_type: exam.type,
            exam_date: exam.date,
            importance: exam.importance,
          }),
        })
      }

      // Build the first deterministic plan before leaving onboarding.
      // Registration is not considered complete from the student's perspective
      // until Havan has something actionable to recommend.
      try {
        await apiFetch(`/planner/generate`, {
          method: 'POST',
          body: JSON.stringify({ student_id: created.id, horizon_days: 7 }),
        })
        window.location.href = '/student/planner'
        return
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Your profile was saved, but Havan could not build the first plan.')
      }

      await loadContext(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your study profile.')
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

  async function saveExam() {
    if (!studentId || !examForm.courseId || !examForm.date) return
    setSaving(true)
    setError('')
    try {
      await apiFetch(
        `/students/profiles/${studentId}/exams${editingExamId ? '/' + editingExamId : ''}`,
        {
          method: editingExamId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            course_id: Number(examForm.courseId),
            exam_type: examForm.type,
            exam_date: examForm.date,
            importance: examForm.importance,
          }),
        },
      )
      setExamForm({ courseId: '', type: 'FINAL', date: '', importance: 4 })
      setEditingExamId(null)
      await loadContext(studentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the exam.')
    } finally {
      setSaving(false)
    }
  }

  function beginEditExam(exam: Item) {
    setEditingExamId(exam.id)
    setExamForm({
      courseId: String(exam.course_id),
      type: exam.exam_type,
      date: exam.exam_date,
      importance: Number(exam.importance ?? 3),
    })
  }

  function cancelExamEdit() {
    setEditingExamId(null)
    setExamForm({ courseId: '', type: 'FINAL', date: '', importance: 4 })
  }

  async function deleteExam(examId: number) {
    if (!studentId || saving) return
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/students/profiles/${studentId}/exams/${examId}`, { method: 'DELETE' })
      if (editingExamId === examId) cancelExamEdit()
      await loadContext(studentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the exam.')
    } finally {
      setSaving(false)
    }
  }

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayProgress = useMemo(() => {
    const items = context?.progress ?? []
    return items.filter((item: Item) => item.status === 'IN_PROGRESS').length
  }, [context])

  const academicProgress = useMemo(() => {
    const total = topics.reduce((sum, topic) => sum + Number(topic.estimated_study_minutes || 0), 0)
    const completed = topics.reduce((sum, topic) => {
      const progress = context?.progress?.find((item: Item) => item.topic_id === topic.id)
      return sum + Math.min(Number(progress?.completed_minutes || 0), Number(topic.estimated_study_minutes || 0))
    }, 0)
    return {
      total,
      completed,
      percent: total ? Math.min(100, Math.round((completed / total) * 100)) : 0,
    }
  }, [topics, context])

  const upcomingExam = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return (context?.exams ?? [])
      .map((exam: Item) => {
        const date = new Date(exam.exam_date + 'T00:00:00')
        const days = Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 86400000))
        return { ...exam, date, days }
      })
      .filter((exam: Item) => exam.date >= now)
      .sort((a: Item, b: Item) => a.date.getTime() - b.date.getTime())[0] ?? null
  }, [context])

  const upcomingExamCourse = upcomingExam
    ? courses.find((course) => course.id === upcomingExam.course_id)
    : null

  const courseCards = useMemo(
    () => (context?.courses ?? []).map((item: Item) => {
      const course = courses.find((courseItem) => courseItem.id === item.course_id)
      const courseTopics = topics.filter((topic) => topic.course_id === item.course_id)
      const completed = courseTopics.filter((topic) =>
        context?.progress?.some((progress: Item) => progress.topic_id === topic.id && progress.status === 'COMPLETED'),
      ).length
      return {
        ...item,
        course,
        topicCount: courseTopics.length,
        completed,
        percent: courseTopics.length ? Math.round((completed / courseTopics.length) * 100) : 0,
      }
    }),
    [context, courses, topics],
  )

  if (loading) {
    return <main className="student-shell"><div className="student-loading">Building your Havan study space…</div></main>
  }

  if (!studentId) {
    const selectedCount = draft.courseIds.length

    return (
      <main className="student-shell">
        <header className="student-brand">
          <span className="student-mark">H</span>
          <strong>havan</strong>
          <span>Study Planner</span>
        </header>

        <section className="onboard">
          <div className="student-progress">
            {[0, 1, 2, 3].map((item) => (
              <span key={item} className={item <= step ? 'active' : ''} />
            ))}
          </div>

          {step === 0 && (
            <>
              <span className="student-eyebrow">01 · ACADEMIC IDENTITY</span>
              <h1>Let Havan understand where you actually study.</h1>
              <p className="student-lead">
                Your university and curriculum determine the academic knowledge Havan can use.
                No generic calendar pretending every student has the same workload.
              </p>
              <label>Your name
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Hana" required />
              </label>
              <label>University
                <select value={draft.universityId} onChange={(e) => setDraft({ ...draft, universityId: e.target.value, curriculumId: '', streamId: '', courseIds: [], confidence: {} })}>
                  <option value="">Select university</option>
                  {universities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>Curriculum
                <select disabled={!draft.universityId} value={draft.curriculumId} onChange={(e) => setDraft({ ...draft, curriculumId: e.target.value, streamId: '', courseIds: [], confidence: {} })}>
                  <option value="">Select curriculum</option>
                  {curriculums.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}
                </select>
              </label>
              <label>Stream
                <select disabled={!draft.curriculumId} value={draft.streamId} onChange={(e) => setDraft({ ...draft, streamId: e.target.value, courseIds: [], confidence: {} })}>
                  <option value="">Select stream</option>
                  {streams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              {error && <div className="student-error">{error}</div>}
              <div className="student-actions">
                <button className="student-primary" disabled={!draft.name.trim() || !draft.streamId} onClick={() => setStep(1)}>Continue</button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <span className="student-eyebrow">02 · COURSE SCOPE</span>
              <h1>Tell Havan what you are carrying this term.</h1>
              <p className="student-lead">
                Pick the courses you genuinely need to study. Then rate your confidence.
                That gives the recommendation engine a much better starting signal.
              </p>
              <div className="course-pick-list">
                {courses.map((course) => {
                  const id = String(course.id)
                  const selected = draft.courseIds.includes(id)
                  return (
                    <div className={selected ? 'course-pick selected' : 'course-pick'} key={course.id}>
                      <button
                        className="course-pick-main"
                        onClick={() => setDraft({
                          ...draft,
                          courseIds: selected
                            ? draft.courseIds.filter((value) => value !== id)
                            : [...draft.courseIds, id],
                          confidence: { ...draft.confidence, [id]: draft.confidence[id] ?? 3 },
                        })}
                      >
                        <span><b>{course.code}</b>{course.name}</span>
                        <i>{selected ? '✓' : '+'}</i>
                      </button>
                      {selected && (
                        <div className="confidence-pick">
                          <span>Confidence</span>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              className={draft.confidence[id] === value ? 'confidence-dot selected' : 'confidence-dot'}
                              onClick={() => setDraft({ ...draft, confidence: { ...draft.confidence, [id]: value } })}
                            >{value}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="selection-note"><b>{selectedCount}</b> course{selectedCount === 1 ? '' : 's'} selected</div>
              <div className="student-actions">
                <button className="student-secondary" onClick={() => setStep(0)}>Back</button>
                <button className="student-primary" disabled={!selectedCount} onClick={() => setStep(2)}>Continue</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <span className="student-eyebrow">03 · EXAM PRESSURE</span>
              <h1>Deadlines change what deserves attention.</h1>
              <p className="student-lead">Add the exams you already know. Havan uses their distance and importance when recommending topics.</p>
              <div className="exam-builder">
                <select value={examForm.courseId} onChange={(e) => setExamForm({ ...examForm, courseId: e.target.value })}>
                  <option value="">Course</option>
                  {selectedCourses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
                </select>
                <select value={examForm.type} onChange={(e) => setExamForm({ ...examForm, type: e.target.value })}><option>FINAL</option><option>MIDTERM</option><option>QUIZ</option></select>
                <input type="date" min={new Date().toISOString().slice(0, 10)} value={examForm.date} onChange={(e) => setExamForm({ ...examForm, date: e.target.value })} />
                <select value={examForm.importance} onChange={(e) => setExamForm({ ...examForm, importance: Number(e.target.value) })}><option value={5}>Critical</option><option value={4}>Important</option><option value={3}>Normal</option><option value={2}>Low</option><option value={1}>Minor</option></select>
                <button className="student-secondary" disabled={!examForm.courseId || !examForm.date} onClick={() => { setDraftExams([...draftExams, { ...examForm }]); setExamForm({ ...examForm, courseId: '', date: '' }) }}>Add exam</button>
              </div>
              {draftExams.length > 0 ? (
                <div className="draft-exams">{draftExams.map((exam, index) => {
                  const course = selectedCourses.find((item) => String(item.id) === exam.courseId)
                  return <div className="draft-exam" key={index}><div><b>{course?.code}</b><span>{exam.type} · {exam.date}</span></div><button onClick={() => setDraftExams(draftExams.filter((_, i) => i !== index))}>Remove</button></div>
                })}</div>
              ) : <div className="exam-empty">No exams added yet. You can add them later.</div>}
              <div className="student-actions">
                <button className="student-secondary" onClick={() => setStep(1)}>Back</button>
                <button className="student-primary" onClick={() => setStep(3)}>Continue</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <span className="student-eyebrow">04 · REALISTIC CAPACITY</span>
              <h1>Give the planner a boundary, not a fantasy.</h1>
              <p className="student-lead">Havan recommends work inside this capacity. You remain in control and can move, skip, complete, or regenerate tasks later.</p>
              <label>Study hours per day
                <input type="number" min="0.5" max="12" step="0.5" value={draft.studyHours} onChange={(e) => setDraft({ ...draft, studyHours: Number(e.target.value) })} />
              </label>
              <span className="day-label">Normal study days</span>
              <div className="day-pick">{DAYS.map((day) => <button key={day.id} className={draft.studyDays.includes(day.id) ? 'day selected' : 'day'} onClick={() => setDraft({ ...draft, studyDays: draft.studyDays.includes(day.id) ? draft.studyDays.filter((id) => id !== day.id) : [...draft.studyDays, day.id] })}>{day.short}</button>)}</div>
              <div className="capacity"><b>{(draft.studyHours * draft.studyDays.length).toFixed(1)}h</b><span>normal weekly study capacity</span></div>
              <div className="review-card"><b>{draft.name}</b><span>{universities.find((item) => String(item.id) === draft.universityId)?.name}</span><span>{streams.find((item) => String(item.id) === draft.streamId)?.name}</span><span>{selectedCount} courses · {draftExams.length} exams · {draft.studyHours}h/day</span></div>
              {error && <div className="student-error">{error}</div>}
              <div className="student-actions">
                <button className="student-secondary" onClick={() => setStep(2)}>Back</button>
                <button className="student-primary" disabled={saving || !draft.studyDays.length} onClick={createProfile}>{saving ? 'Building your plan…' : 'Create my study space'}</button>
              </div>
            </>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="student-shell dashboard-shell">
      <header className="student-topbar student-dashboard-topbar">
        <a className="student-brand" href="/student">
          <span className="student-mark">H</span>
          <strong>havan</strong>
          <span>Study Planner</span>
        </a>
        <nav className="dashboard-nav" aria-label="Student navigation">
          <span className="student-context">{profile?.study_hours_per_day ?? 0}h/day</span>
          <span className="dashboard-avatar">{initials(profile?.name ?? '')}</span>
        </nav>
      </header>

      {error && (
        <div className="student-error top-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
        </div>
      )}

      <section className="dashboard-welcome">
        <div>
          <span className="student-eyebrow">HAVAN STUDENT DASHBOARD</span>
          <h1>Good to see you, {profile?.name?.split(' ')[0] ?? 'Student'}.</h1>
          <p>Your plan, progress, and next academic priority in one simple view.</p>
        </div>
        <a className="hero-action dashboard-primary-action" href="/student/planner">Open study plan <span>→</span></a>
      </section>

      <section className="dashboard-kpis" aria-label="Study overview">
        <article className="dashboard-kpi dashboard-kpi-primary">
          <span>ACADEMIC PROGRESS</span>
          <strong>{academicProgress.percent}%</strong>
          <div className="dashboard-progress-track"><i style={{ width: academicProgress.percent + '%' }} /></div>
          <small>{completedTopics} of {topics.length} topics complete</small>
        </article>
        <article className="dashboard-kpi">
          <span>IN PROGRESS</span>
          <strong>{todayProgress}</strong>
          <small>topics currently active</small>
        </article>
        <article className="dashboard-kpi">
          <span>COURSES</span>
          <strong>{context?.courses?.length ?? 0}</strong>
          <small>{topics.length} active topics in scope</small>
        </article>
        <article className="dashboard-kpi">
          <span>NEXT EXAM</span>
          <strong>{upcomingExam ? (upcomingExam.days === 0 ? 'Today' : upcomingExam.days + 'd') : '—'}</strong>
          <small>{upcomingExamCourse?.code ?? 'No upcoming exam'}</small>
        </article>
      </section>

      <section className="dashboard-focus-grid">
        <article className="dashboard-focus-card dashboard-next-card">
          <div className="dashboard-card-head">
            <div><span className="student-eyebrow">NEXT PRIORITY</span><h2>{upcomingExam ? upcomingExamCourse?.name ?? 'Upcoming exam' : 'Your study plan'}</h2></div>
            <span className="dashboard-card-mark">01</span>
          </div>
          {upcomingExam ? (
            <>
              <p className="dashboard-focus-date">{upcomingExam.exam_type} · {upcomingExam.exam_date}</p>
              <div className="dashboard-exam-countdown"><strong>{upcomingExam.days === 0 ? 'Today' : upcomingExam.days}</strong><span>{upcomingExam.days === 0 ? 'exam day' : 'days remaining'}</span></div>
              <p>Havan uses this deadline and its importance when ordering recommendations for you.</p>
              <a className="dashboard-text-link" href="/student/planner">See recommendations →</a>
            </>
          ) : (
            <>
              <p>No upcoming exam is registered yet. Your planner can still work from progress, confidence, and capacity.</p>
              <a className="dashboard-text-link" href="#assessments">Add an exam →</a>
            </>
          )}
        </article>

        <article className="dashboard-focus-card dashboard-progress-card">
          <div className="dashboard-card-head">
            <div><span className="student-eyebrow">PROGRESS</span><h2>Keep moving</h2></div>
            <span className="dashboard-card-mark">02</span>
          </div>
          <div className="dashboard-big-progress"><span style={{ width: academicProgress.percent + '%' }} /></div>
          <div className="dashboard-progress-copy"><strong>{academicProgress.completed} min</strong><span>completed study time</span></div>
          <p>{academicProgress.percent === 100 ? 'Everything currently in scope is complete.' : 'Your progress helps Havan decide what deserves another session.'}</p>
          <a className="dashboard-text-link" href="#progress">Update topic progress →</a>
        </article>
      </section>

      <section className="panel dashboard-courses-panel">
        <div className="dashboard-section-head">
          <div><span className="student-eyebrow">COURSE SCOPE</span><h2>Your courses</h2></div>
          <span>{courseCards.length} selected</span>
        </div>
        <div className="dashboard-course-grid">
          {courseCards.map((item: any) => (
            <article className="dashboard-course-card" key={item.id}>
              <div className="dashboard-course-top">
                <span>{item.course?.code ?? 'COURSE'}</span>
                <b>{item.percent}%</b>
              </div>
              <h3>{item.course?.name ?? 'Course'}</h3>
              <p>{item.completed} of {item.topicCount} topics complete</p>
              <div className="dashboard-progress-track"><i style={{ width: item.percent + '%' }} /></div>
              <span className="confidence">Confidence {item.confidence ?? '—'}/5</span>
            </article>
          ))}
        </div>
      </section>

      {!hasRegisteredTopics && context?.courses?.length > 0 && (
        <section className="panel topic-registration-warning">
          <div className="panel-heading"><div><span className="student-eyebrow">ACADEMIC DATA STATUS</span><h2>No topics registered yet</h2></div></div>
          <p>Your selected courses are registered, but Havan needs active chapters and topics before it can generate academic recommendations.</p>
          <div className="topic-status-list">{courseTopicStatus.map((item: Item) => (
            <div className="topic-status-row" key={item.course_id}><div><b>{item.course_code}</b><span>{item.course_name}</span></div><strong>{item.chapter_count} chapters · {item.active_topic_count} topics</strong></div>
          ))}</div>
        </section>
      )}

      {hasRegisteredTopics && coursesWithoutTopics.length > 0 && (
        <section className="panel topic-registration-warning">
          <div className="panel-heading"><div><span className="student-eyebrow">ACADEMIC DATA STATUS</span><h2>Some courses need topics</h2></div></div>
          <p>Havan can recommend from courses with registered topics. These selected courses still need academic content.</p>
          <div className="topic-status-list">{coursesWithoutTopics.map((item: Item) => (
            <div className="topic-status-row" key={item.course_id}><div><b>{item.course_code}</b><span>{item.course_name}</span></div><strong>{item.chapter_count} chapters · 0 topics</strong></div>
          ))}</div>
        </section>
      )}

      <section className="dashboard-manage-grid">
        <details className="panel dashboard-details" id="assessments">
          <summary><span><span className="student-eyebrow">ASSESSMENTS</span><b>Manage exam dates</b></span><i>+</i></summary>
          <div className="dashboard-details-body">
            {context?.exams?.length ? context.exams.map((exam: Item) => {
              const course = courses.find((item) => item.id === exam.course_id)
              const days = Math.max(0, Math.ceil((new Date(exam.exam_date + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86400000))
              return (
                <div className="exam-row exam-row-managed" key={exam.id}>
                  <div><b>{course?.code ?? 'Course'}</b><span>{exam.exam_type} · Importance {exam.importance}/5 · {days === 0 ? 'Today' : days + 'd left'}</span></div>
                  <div className="exam-row-actions"><strong>{exam.exam_date}</strong><button type="button" onClick={() => beginEditExam(exam)}>Edit</button><button type="button" onClick={() => deleteExam(exam.id)} disabled={saving}>Remove</button></div>
                </div>
              )
            }) : <p className="muted">No exam dates yet.</p>}
            <div className="exam-form">
              <select value={examForm.courseId} onChange={(e) => setExamForm({ ...examForm, courseId: e.target.value })}><option value="">Course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code}</option>)}</select>
              <select value={examForm.type} onChange={(e) => setExamForm({ ...examForm, type: e.target.value })}><option>FINAL</option><option>MIDTERM</option><option>QUIZ</option></select>
              <input type="date" min={todayKey} value={examForm.date} onChange={(e) => setExamForm({ ...examForm, date: e.target.value })} />
              <select value={examForm.importance} onChange={(e) => setExamForm({ ...examForm, importance: Number(e.target.value) })}><option value={5}>Critical</option><option value={4}>Important</option><option value={3}>Normal</option><option value={2}>Low</option><option value={1}>Minor</option></select>
              <div className="exam-form-actions"><button type="button" className="student-secondary" disabled={saving || !examForm.courseId || !examForm.date} onClick={saveExam}>{saving ? 'Saving…' : editingExamId ? 'Save changes' : 'Add exam'}</button>{editingExamId && <button type="button" className="student-secondary" onClick={cancelExamEdit}>Cancel</button>}</div>
            </div>
          </div>
        </details>

        <details className="panel dashboard-details" id="progress">
          <summary><span><span className="student-eyebrow">TOPIC PROGRESS</span><b>Update what you know</b></span><i>+</i></summary>
          <div className="dashboard-details-body">
            {topics.slice(0, 20).map((topic) => {
              const progress = context?.progress?.find((item: Item) => item.topic_id === topic.id)
              const status = progress?.status ?? 'NOT_STARTED'
              return (
                <div className="topic-row" key={topic.id}>
                  <div><b>{topic.name}</b><span>{topic.estimated_study_minutes} min · difficulty {topic.difficulty}/5</span></div>
                  <button className={status === 'COMPLETED' ? 'progress-button complete' : status === 'IN_PROGRESS' ? 'progress-button active' : 'progress-button'} onClick={() => updateProgress(topic.id, status === 'NOT_STARTED' ? 'IN_PROGRESS' : status === 'IN_PROGRESS' ? 'COMPLETED' : 'NOT_STARTED')}>
                    {status === 'NOT_STARTED' ? 'Start' : status === 'IN_PROGRESS' ? 'Complete' : 'Completed'}
                  </button>
                </div>
              )
            })}
          </div>
        </details>
      </section>

      <p className="student-footer">Havan recommends. You decide what actually happens.</p>
    </main>
  )
}