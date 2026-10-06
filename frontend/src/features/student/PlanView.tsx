'use client'
import { useEffect, useState } from 'react'
import { AppShell, PageHeader } from '@/components/layout'
import { Button, Card, Chip, EmptyState, ErrorState } from '@/components/ui'
import { getCurrentPlan, planAction, type Plan } from '@/lib/plan'
export default function PlanView() {
  const [p, setP] = useState<Plan | null>(null)
  const [e, setE] = useState('')
  const [targetDates, setTargetDates] = useState<Record<number, string>>({})
  const [pendingTask, setPendingTask] = useState<number | null>(null)
  useEffect(() => {
    getCurrentPlan()
      .then(setP)
      .catch((x) => setE(x instanceof Error ? x.message : ''))
  }, [])
  const modeLabel = p?.mode === 'today' ? 'Today' : p?.mode === 'month' ? 'Month' : 'Week'
  const completedCount = p?.tasks.filter((task) => task.status === 'DONE').length ?? 0
  const plannedMinutes = p?.tasks.filter((task) => task.status !== 'SKIPPED').reduce((total, task) => total + task.minutes, 0) ?? 0
  const groupedTasks = p ? p.tasks.reduce<Record<string, Plan['tasks']>>((groups, task) => {
    ;(groups[task.planned_date] ||= []).push(task)
    return groups
  }, {}) : {}
  const orderedDays = Object.entries(groupedTasks).sort(([a], [b]) => a.localeCompare(b))
  const act = async (id: number, action: 'START' | 'COMPLETE' | 'SKIP' | 'MOVE' | 'REPEAT') => {
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
        description="Every task has a reason. You decide what happens next."
        action={
          <Button variant="secondary" onClick={() => (location.href = '/plan/new')}>
            Change plan
          </Button>
        }
      />
      {e ? (
        <ErrorState onRetry={() => location.reload()} message={e} />
      ) : !p ? (
        <EmptyState
          title="No plan yet"
          hint="Build a plan from topics you choose."
          action={
            <Button onClick={() => (location.href = '/plan/new')}>
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
