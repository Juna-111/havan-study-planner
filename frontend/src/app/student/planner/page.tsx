'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import '../student.css'
import './planner.css'

type Item = Record<string, any>

const KEY = 'havan_student_key'

function getClientKey() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(KEY) || ''
}

export default function PlannerPage() {
  const [studentId, setStudentId] = useState<number | null>(null)
  const [plan, setPlan] = useState<Item | null>(null)
  const [courses, setCourses] = useState<Item[]>([])
  const [topics, setTopics] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics])

  async function apiList(path: string) {
    const result = await apiFetch<Item>(path)
    return result.items ?? result
  }

  async function loadPlan(id: number) {
    try {
      const latest = await apiFetch<Item>(`/planner/students/${id}/latest`)
      setPlan(latest)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (!message.includes('404')) setError(message || 'Could not load your plan.')
    }
  }

  async function loadContext(id: number) {
    const context = await apiFetch<Item>(`/students/profiles/${id}/context`)
    const courseIds = (context.courses ?? []).map((c: Item) => c.course_id)
    const profile = context.profile
    const courseItems = await apiList(`/courses?stream_id=${profile.stream_id}&page=1&page_size=100`)
    const selected = courseItems.filter((c: Item) => courseIds.includes(c.id))
    const chapters = (await Promise.all(selected.map((c: Item) => apiList(`/chapters?course_id=${c.id}&page=1&page_size=100`)))).flat()
    const topicItems = (await Promise.all(chapters.map((c: Item) => apiList(`/topics?chapter_id=${c.id}&page=1&page_size=100`)))).flat()
    setStudentId(id)
    setCourses(selected)
    setTopics(topicItems)
    await loadPlan(id)
  }

  useEffect(() => {
    const key = getClientKey()
    if (!key) {
      setError('Create your student profile first.')
      setLoading(false)
      return
    }
    apiFetch<Item>(`/students/profiles/by-client/${key}`)
      .then((profile) => loadContext(profile.id))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your student profile.'))
      .finally(() => setLoading(false))
  }, [])

  async function generate() {
    if (!studentId) return
    setGenerating(true)
    setError('')
    try {
      const next = await apiFetch<Item>(`/planner/students/${studentId}/generate`, {
        method: 'POST',
        body: JSON.stringify({ horizon_days: 7 }),
      })
      setPlan(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate your plan.')
    } finally {
      setGenerating(false)
    }
  }

  async function updateTask(task: Item, status: string) {
    if (!studentId) return
    try {
      const updated = await apiFetch<Item>(`/planner/students/${studentId}/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setPlan((current: Item | null) => current ? {
        ...current,
        tasks: current.tasks.map((item: Item) => item.id === updated.id ? updated : item),
      } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the study task.')
    }
  }

  if (loading) return <main className="student-shell"><div className="student-loading">Building your planning space…</div></main>

  const grouped = (plan?.tasks ?? []).reduce((groups: Record<string, Item[]>, task: Item) => {
    const key = task.planned_date
    groups[key] = groups[key] ?? []
    groups[key].push(task)
    return groups
  }, {})

  return (
    <main className="student-shell planner-shell">
      <header className="student-topbar">
        <a className="student-brand" href="/student"><span className="student-mark">H</span><strong>havan</strong><span>Study Planner</span></a>
        <a className="planner-back" href="/student">Back to dashboard</a>
      </header>

      <section className="planner-hero">
        <div>
          <span className="student-eyebrow">RECOMMENDED STUDY PLAN</span>
          <h1>Your week, based on your actual academic context.</h1>
          <p>The planner considers your courses, progress, available time, topic difficulty, importance, prerequisites, and upcoming exams. Recommendations are suggestions, not commands.</p>
        </div>
        <button className="student-primary" disabled={generating || !studentId} onClick={generate}>
          {generating ? 'Planning…' : plan ? 'Regenerate plan' : 'Generate my plan'}
        </button>
      </section>

      {error && <div className="student-error planner-error">{error}</div>}

      {!plan && !error && (
        <section className="planner-empty panel">
          <span className="student-eyebrow">READY WHEN YOU ARE</span>
          <h2>Nothing is scheduled yet.</h2>
          <p>Generate a seven-day recommendation from the academic data you already gave Havan.</p>
        </section>
      )}

      {plan && Object.keys(grouped).map((date) => (
        <section className="planner-day panel" key={date}>
          <div className="planner-day-heading">
            <div><span className="student-eyebrow">{new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}</span><h2>{new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</h2></div>
            <span>{grouped[date].reduce((sum, task) => sum + task.estimated_minutes, 0)} min planned</span>
          </div>

          {grouped[date].map((task) => {
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
                  <span>Priority {task.priority.toFixed(2)}</span>
                  {task.status === 'COMPLETED' ? (
                    <button className="task-complete" onClick={() => updateTask(task, 'RECOMMENDED')}>Completed</button>
                  ) : (
                    <div className="task-actions">
                      <button onClick={() => updateTask(task, 'COMPLETED')}>Complete</button>
                      <button onClick={() => updateTask(task, 'SKIPPED')}>Skip</button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      ))}

      {plan && !plan.tasks?.length && (
        <section className="planner-empty panel">
          <h2>No recommendations were generated.</h2>
          <p>All available topics may already be complete, or your current study capacity is too constrained for the selected horizon.</p>
        </section>
      )}

      <p className="student-footer">Havan recommends. You decide what actually happens.</p>
    </main>
  )
}
