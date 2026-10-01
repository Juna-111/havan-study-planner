
'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import '../student.css'
import './planner.css'

type Item = Record<string, any>
type Task = Item & { estimated_minutes: number }

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
  const [moveDate, setMoveDate] = useState('')
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null)
  const [focusSeconds, setFocusSeconds] = useState(25 * 60)

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
      '/courses?stream_id=' + nextProfile.stream_id + '&page=1&page_size=100',
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
          apiList('/topics?chapter_id=' + chapter.id + '&page=1&page_size=100'),
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

  async function actOnTask(task: Task, action: 'START' | 'COMPLETE' | 'SKIP' | 'MOVE', targetDate?: string) {
    if (!studentId || actionBusy) return
    setActionBusy(true)
    setError('')
    try {
      const updatedPlan = await apiFetch<Item>('/planner/students/' + studentId + '/tasks/' + task.id + '/action', {
        method: 'POST',
        body: JSON.stringify({ action, target_date: targetDate || null }),
      })
      setPlan(updatedPlan)
      if (action === 'START') {
        setFocusTaskId(task.id)
        setFocusSeconds(25 * 60)
        setSelectedTaskId(null)
        setToast('Focus mode started. One session, one topic, no heroic promises required.')
      } else if (action === 'COMPLETE') {
        setFocusTaskId(null)
        setSelectedTaskId(null)
        setToast('Session completed. Havan recorded the progress and recalculated what comes next.')
      } else if (action === 'SKIP') {
        setSelectedTaskId(null)
        setToast('Skipped and recorded. Havan rebuilt the remaining week around that decision.')
      } else {
        setSelectedDate(updated.planned_date)
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

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : null
  const selectedTopic = selectedTask ? topicMap.get(selectedTask.topic_id) : null
  const selectedCourse = selectedTask ? courseMap.get(selectedTask.course_id) : null

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
          <span className="planner-user">
            <span className="planner-avatar">{initials(profile?.name ?? '')}</span>
            <span>{profile?.name ?? 'Student'}</span>
          </span>
        </nav>
      </header>

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
          <span className="planner-capacity">
            {profile?.study_hours_per_day ?? 0}h/day
            <small>available capacity</small>
          </span>
          <button
            className="student-primary planner-regenerate"
            type="button"
            disabled={generating || !studentId}
            onClick={() => studentId && generatePlan(studentId)}
          >
            {generating ? 'Rebuilding…' : 'Refresh plan'}
          </button>
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
                  Phase 5 is deliberately deterministic. Havan considers exam urgency,
                  topic importance, senior-student difficulty, student confidence, progress,
                  prerequisites, available capacity, and revision need.
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
                  <span>Phase 6.1 explains recommendations. Task changes are intentionally reserved for Phase 6.2.</span>
                </div>
              </section>

              {upcomingExam && (
                <section className="planner-side-card planner-exam-card panel">
                  <span className="student-eyebrow">ASSESSMENT AHEAD</span>
                  <strong className="planner-exam-title">
                    {courseMap.get(upcomingExam.course_id)?.code ?? 'Course'} {upcomingExam.exam_type}
                  </strong>
                  <span className="planner-exam-date">
                    {formatDate(upcomingExam.dateObject, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                  <b>{examDays === 0 ? 'Today' : examDays + ' days away'}</b>
                  <a href="/student">Manage exam dates →</a>
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
            <section className="planner-focus-mode" role="dialog" aria-modal="true" aria-labelledby="focus-mode-title">
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
            </section>
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
              <span className="student-eyebrow">WHY IT IS HERE</span>
              <p>{selectedTask.reason}</p>
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
              <button
                type="button"
                className="planner-action planner-action-primary"
                disabled={actionBusy || selectedTask.status === 'COMPLETED'}
                onClick={() => actOnTask(selectedTask, 'START')}
              >
                <strong>Start focus</strong>
                <span>25-minute study session</span>
              </button>
              <button
                type="button"
                className="planner-action"
                disabled={actionBusy}
                onClick={() => actOnTask(selectedTask, 'COMPLETE')}
              >
                <strong>Complete</strong>
                <span>Record the topic as finished</span>
              </button>
              <button
                type="button"
                className="planner-action"
                disabled={actionBusy || selectedTask.status === 'COMPLETED'}
                onClick={() => actOnTask(selectedTask, 'SKIP')}
              >
                <strong>Skip today</strong>
                <span>Keep the decision explicit</span>
              </button>
            </div>

            <div className="planner-move-row">
              <div>
                <span className="student-eyebrow">MOVE SESSION</span>
                <p>Choose a future date without touching your other sessions.</p>
              </div>
              <div className="planner-move-controls">
                <input
                  type="date"
                  min={dateKey(today())}
                  value={moveDate}
                  onChange={(event) => setMoveDate(event.target.value)}
                  aria-label="New study date"
                />
                <button
                  type="button"
                  className="student-secondary"
                  disabled={actionBusy || !moveDate || selectedTask.status === 'COMPLETED'}
                  onClick={() => actOnTask(selectedTask, 'MOVE', moveDate)}
                >
                  Move
                </button>
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
