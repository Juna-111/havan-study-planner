'use client'
import { useEffect, useMemo, useState } from 'react'
import { AppShell, PageHeader } from '@/components/layout'
import { Button, Card, Chip, EmptyState, ErrorState } from '@/components/ui'
import { getCurrentPlan, planAction, type Plan } from '@/lib/plan'
import { apiFetch } from '@/lib/api'
export default function PlanView() {
  const [p, setP] = useState<Plan | null>(null)
  const [e, setE] = useState('')
  const [targetDates, setTargetDates] = useState<Record<number, string>>({})
  const [pendingTask, setPendingTask] = useState<number | null>(null)
  const [catalog, setCatalog] = useState<{ id: number; code: string; name: string; chapters: { id: number; name: string; topics: { id: number; name: string }[] }[] }[]>([])
  const [addTopicId, setAddTopicId] = useState('')
  const [addError, setAddError] = useState('')
  useEffect(() => {
    getCurrentPlan()
      .then(setP)
      .catch((x) => setE(x instanceof Error ? x.message : ''))
  }, [])
  useEffect(() => {
    apiFetch<typeof catalog>('/students/me/catalog').then(setCatalog).catch(() => setCatalog([]))
  }, [])
  const addOptions = useMemo(
    () => catalog.flatMap((course) => course.chapters.flatMap((chapter) => chapter.topics.map((topic) => ({
      id: topic.id,
      label: course.code + ' · ' + chapter.name + ' · ' + topic.name,
    })))),
    [catalog],
  )
  const modeLabel = p?.mode === 'today' ? 'Today' : p?.mode === 'month' ? 'Month' : 'Week'
  const completedCount = p?.tasks.filter((task) => task.status === 'DONE').length ?? 0
  const plannedMinutes = p?.tasks.filter((task) => task.status !== 'SKIPPED').reduce((total, task) => total + task.minutes, 0) ?? 0
  const groupedTasks = p ? p.tasks.reduce<Record<string, Plan['tasks']>>((groups, task) => {
    ;(groups[task.planned_date] ||= []).push(task)
    return groups
  }, {}) : {}
  const orderedDays = Object.entries(groupedTasks).sort(([a], [b]) => a.localeCompare(b))
  const act = async (id: number, action: 'START' | 'COMPLETE' | 'SKIP' | 'MOVE' | 'REPEAT' | 'REMOVE') => {
    if (!p) return
    try {
      setE('')
      setPendingTask(id)
      const target_date = targetDates[id] || undefined
      if ((action === 'MOVE' || action === 'REPEAT') && !target_date) {
        setE('Choose a date before moving or repeating a task.')
        return
      }
      setP(await planAction(id, { action, target_date }))
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Action failed.')
    } finally {
      setPendingTask(null)
    }
  }
  return (
    <AppShell>
      <PageHeader
        title="Your plan"
        description="You chose these topics. Now control how each study task fits your time."
        action={
          <Button variant="secondary" onClick={() => (location.href = '/student/havan')}>
            Change selected topics
          </Button>
        }
      />
      {e ? (
        <ErrorState onRetry={() => location.reload()} message={e} />
      ) : !p ? (
        <EmptyState
          title="No plan yet"
          hint="Choose the course, chapter, and topics you want Havan to organize."
          action={
            <Button variant="accent" onClick={() => (location.href = '/student/havan')}>
              Build a plan
            </Button>
          }
        />
      ) : (
        <div className="stack">
          <Card padding="lg" className="plan-overview">
            <div>
              <span className="app-eyebrow">HAVAN {modeLabel.toUpperCase()}</span>
              <h2>{completedCount} of {p.tasks.length} tasks complete</h2>
              <p>{plannedMinutes} minutes planned across {p.horizon_days} {p.horizon_days === 1 ? 'day' : 'days'}.</p>
            </div>
            <div className="plan-overview-stats">
              <strong>{p.total_minutes} min</strong>
              <span>planned study time</span>
            </div>
          </Card>
          <Card padding="lg" className="plan-add-topic">
            <span className="app-eyebrow">ADD TO YOUR PLAN</span>
            <h2>Add a topic</h2>
            <p className="app-meta">Choose another topic yourself. Havan will place it as a manual addition, not as a recommendation.</p>
            <div className="row">
              <select value={addTopicId} onChange={(event) => { setAddTopicId(event.target.value); setAddError('') }}>
                <option value="">Choose a topic</option>
                {addOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <Button
                variant="accent"
                disabled={!addTopicId || pendingTask !== null}
                onClick={async () => {
                  try {
                    setAddError('')
                    setPendingTask(0)
                    setP(await planAction(0, { action: 'ADD', target_topic_id: Number(addTopicId) }))
                    setAddTopicId('')
                  } catch (x) {
                    setAddError(x instanceof Error ? x.message : 'Could not add that topic.')
                  } finally {
                    setPendingTask(null)
                  }
                }}
              >
                Add topic
              </Button>
            </div>
            {addError && <p className="app-meta">{addError}</p>}
          </Card>
          {p.warnings.map((w) => (
            <Chip
              key={w.code}
              tone={
                w.severity === 'danger'
                  ? 'danger'
                  : w.severity === 'warn'
                    ? 'warn'
                    : 'info'
              }
            >
              {w.message}
            </Chip>
          ))}
          {orderedDays.map(([date, tasks]) => (
            <section className="plan-day" key={date}>
              <div className="plan-day-heading">
                <h2>{date}</h2>
                <span>{tasks.reduce((total, task) => total + task.minutes, 0)} min</span>
              </div>
              {tasks.map((t) => (
                <Card key={t.id} as="article" padding="lg" className="plan-task">
                  <div className="row">
                    <Chip tone={t.status === 'DONE' ? 'success' : 'info'}>
                      {t.status}
                    </Chip>
                    <strong>{t.planned_date}</strong>
                  </div>
                  <h2 className="plan-task-title">{t.topic_name}</h2>
                  <p>{t.reason}</p>
                  <small>
                    {t.minutes} min · {t.course_name}
                  </small>
                  <div className="plan-task-actions">
                    {t.status !== 'DONE' && (
                      <Button
                        disabled={pendingTask === t.id}
                        onClick={() =>
                          act(t.id, t.status === 'PLANNED' ? 'START' : 'COMPLETE')
                        }
                      >
                        {pendingTask === t.id ? 'Saving...' : t.status === 'PLANNED' ? 'Start' : 'Complete'}
                      </Button>
                    )}
                    {t.status !== 'DONE' && (
                      <Button disabled={pendingTask === t.id} variant="ghost" onClick={() => act(t.id, 'SKIP')}>
                        Skip
                      </Button>
                    )}
                    {t.status !== 'DONE' && (
                      <Button disabled={pendingTask === t.id} variant="ghost" onClick={() => act(t.id, 'REMOVE')}>
                        Remove
                      </Button>
                    )}
                    <label className="plan-task-date">
                      <span>{t.status === 'DONE' ? 'Repeat on' : 'Move to'}</span>
                      <input
                        type="date"
                        value={targetDates[t.id] || ''}
                        onChange={(event) => setTargetDates((old) => ({ ...old, [t.id]: event.target.value }))}
                      />
                    </label>
                    <Button
                      disabled={pendingTask === t.id}
                      variant={t.status === 'DONE' ? 'ghost' : 'secondary'}
                      onClick={() => act(t.id, t.status === 'DONE' ? 'REPEAT' : 'MOVE')}
                    >
                      {t.status === 'DONE' ? 'Repeat' : 'Reschedule'}
                    </Button>
                  </div>
                </Card>
              ))}
            </section>
          ))}
        </div>
      )}
    </AppShell>
  )
}
