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

export default function PlannerPage() {
  const [studentId, setStudentId] = useState<number | null>(null)
  const [profile, setProfile] = useState<Item | null>(null)
  const [plan, setPlan] = useState<Item | null>(null)
  const [courses, setCourses] = useState<Item[]>([])
  const [topics, setTopics] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses])
  const topicMap = useMemo(() => new Map(topics.map((topic) => [topic.id, topic])), [topics])

  async function apiList(path: string) {
    const result = await apiFetch<Item>(path)
    return result.items ?? result
  }

  async function generatePlan(id: number) {
    setGenerating(true)
    setError('')
    try {
      const next = await apiFetch<Item>(`/planner/students/${id}/generate`, {
        method: 'POST',
        body: JSON.stringify({ horizon_days: 7 }),
      })
      setPlan(next)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate your plan.')
      return false
    } finally {
      setGenerating(false)
    }
  }

  async function loadContext(id: number) {
    const context = await apiFetch<Item>(`/students/profiles/${id}/context`)
    const courseIds = (context.courses ?? []).map((course: Item) => course.course_id)
    const nextProfile = context.profile
    const courseItems = await apiList(`/courses?stream_id=${nextProfile.stream_id}&page=1&page_size=100`)
    const selected = courseItems.filter((course: Item) => courseIds.includes(course.id))
    const chapters = (await Promise.all(selected.map((course: Item) => apiList(`/chapters?course_id=${course.id}&page=1&page_size=100`)))).flat()
    const topicItems = (await Promise.all(chapters.map((chapter: Item) => apiList(`/topics?chapter_id=${chapter.id}&page=1&page_size=100`)))).flat()

    setStudentId(id)
    setProfile(nextProfile)
    setCourses(selected)
    setTopics(topicItems)

    // Always build a fresh deterministic plan when the planner is opened.
    // This prevents an old empty/obsolete plan from masking the current
    // student progress, courses, and exam dates.
    await generatePlan(id)
  }

  useEffect(() => {
    const key = getClientKey()
    if (!key) {
      setError('Create your student profile first.')
      setLoading(false)
      return
    }

    apiFetch<Item>(`/students/profiles/by-client/${encodeURIComponent(key)}`)
      .then((student) => loadContext(student.id))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your student profile.'))
      .finally(() => setLoading(false))
  }, [])

  async function regenerate() {
    if (studentId) await generatePlan(studentId)
  }

  if (loading) {
    return <main className="student-shell"><div className="student-loading">Building your recommendations…</div></main>
  }

  const tasks: Task[] = plan?.tasks ?? []
  const recommended = tasks.filter((task) => task.status === 'RECOMMENDED')
  const totalMinutes = tasks.reduce((sum: number, task: Task) => sum + task.estimated_minutes, 0)

  const grouped = tasks.reduce((groups: Record<string, Task[]>, task: Task) => {
    const key = task.planned_date
    groups[key] = groups[key] ?? []
    groups[key].push(task)
    return groups
  }, {})

  return (
    <main className="student-shell planner-shell">
      <header className="student-topbar">
        <a className="student-brand" href="/student"><span className="student-mark">H</span><strong>havan</strong><span>Study Planner</span></a>
        <a className="planner-back" href="/student">Dashboard</a>
      </header>

      <section className="planner-hero">
        <div>
          <span className="student-eyebrow">HAVAN RECOMMENDATION ENGINE</span>
          <h1>{profile?.name ? `${profile.name}'s study week` : 'Your recommended study week'}</h1>
          <p>Havan weighs exam urgency, topic importance, difficulty, course confidence, progress, prerequisites, and your available time. It recommends. You decide.</p>
        </div>
        <button className="student-primary" disabled={generating || !studentId} onClick={regenerate}>
          {generating ? 'Rebuilding…' : 'Regenerate'}
        </button>
      </section>

      {error && <div className="student-error planner-error">{error}</div>}

      {plan && (
        <section className="planner-insights">
          <article><span>RECOMMENDED</span><b>{recommended.length}</b><small>active study tasks</small></article>
          <article><span>STUDY TIME</span><b>{totalMinutes}m</b><small>planned this week</small></article>
          <article><span>TOPICS</span><b>{topics.length}</b><small>active academic topics</small></article>
          <article className="planner-principle"><span>PHASE 5</span><b>Deterministic</b><small>recommendations only</small></article>
        </section>
      )}

      {plan && recommended.length > 0 && (
        <section className="planner-focus panel">
          <div>
            <span className="student-eyebrow">START HERE</span>
            <h2>Your highest-priority recommendations</h2>
            <p>These are the first tasks Havan thinks deserve attention based on your current data.</p>
          </div>
          <div className="focus-list">
            {recommended.slice(0, 3).map((task: Task) => {
              const topic = topicMap.get(task.topic_id)
              const course = courseMap.get(task.course_id)
              return (
                <div className="focus-card" key={task.id}>
                  <span>{course?.code ?? 'COURSE'} · PRIORITY {Number(task.priority).toFixed(2)}</span>
                  <b>{topic?.name ?? `Topic #${task.topic_id}`}</b>
                  <p>{task.reason}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {!plan && !error && (
        <section className="planner-empty panel">
          <span className="student-eyebrow">PREPARING YOUR WEEK</span>
          <h2>Havan is calculating your recommendations.</h2>
          <p>Your academic context is ready. The planner will build tasks inside your available study capacity.</p>
        </section>
      )}

      {plan && Object.keys(grouped).map((date) => (
        <section className="planner-day panel" key={date}>
          <div className="planner-day-heading">
            <div>
              <span className="student-eyebrow">{new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}</span>
              <h2>{new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</h2>
            </div>
            <span>{grouped[date].reduce((sum: number, task: Task) => sum + task.estimated_minutes, 0)} min planned</span>
          </div>

          {grouped[date].map((task: Task) => {
            const topic = topicMap.get(task.topic_id)
            const course = courseMap.get(task.course_id)
            return (
              <article className={`plan-task ${task.status.toLowerCase()}`} key={task.id}>
                <div className="task-main">
                  <span className="task-course">{course?.code ?? 'Course'}</span>
                  <h3>{topic?.name ?? `Topic #${task.topic_id}`}</h3>
                  <p>{task.reason}</p>
                </div>
                <div className="task-meta">
                  <span>{task.estimated_minutes} min</span>
                  <span>Priority {Number(task.priority).toFixed(2)}</span>
                  <span>Recommended</span>
                </div>
              </article>
            )
          })}
        </section>
      ))}

      {plan && !tasks.length && (
        <section className="planner-empty panel">
          <h2>No unfinished topics are available.</h2>
          <p>Your selected topics may all be complete. Update your progress or add another course to give Havan more academic scope.</p>
        </section>
      )}

      <p className="student-footer">Havan recommends. You decide what actually happens.</p>
    </main>
  )
}
