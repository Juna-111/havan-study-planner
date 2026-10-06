'use client'

import { useEffect, useState } from 'react'
import { AppShell, PageHeader } from '@/components/layout'
import { Button, Card, Chip, EmptyState, ErrorState } from '@/components/ui'
import { getCurrentPlan, planAction, type Plan } from '@/lib/plan'
import { StudentGate } from '@/features/student/StudentGate'

export default function PlanPage() {
  return (
    <StudentGate>
      <View />
    </StudentGate>
  )
}

function View() {
  const [p, setP] = useState<Plan | null>(null)
  const [e, setE] = useState('')
  const [targetDates, setTargetDates] = useState<Record<number, string>>({})

  useEffect(() => {
    getCurrentPlan()
      .then(setP)
      .catch((x) => setE(x instanceof Error ? x.message : ''))
  }, [])

  const act = async (id: number, action: 'START' | 'COMPLETE' | 'SKIP' | 'MOVE' | 'REPEAT') => {
    if (!p) return

    try {
      const target_date = targetDates[id] || undefined
      if ((action === 'MOVE' || action === 'REPEAT') && !target_date) {
        setE('Choose a date before moving or repeating a task.')
        return
      }
      setP(await planAction(id, { action, target_date }))
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Action failed.')
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

          {p.tasks.map((t) => (
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
                    onClick={() =>
                      act(t.id, t.status === 'PLANNED' ? 'START' : 'COMPLETE')
                    }
                  >
                    {t.status === 'PLANNED' ? 'Start' : 'Complete'}
                  </Button>
                )}
                {t.status !== 'DONE' && (
                  <Button variant="ghost" onClick={() => act(t.id, 'SKIP')}>
                    Skip
                  </Button>
                )}
                {t.status === 'DONE' && (
                  <Button variant="ghost" onClick={() => act(t.id, 'REPEAT')}>
                    Repeat
                  </Button>
                )}
                {t.status !== 'DONE' && (
                  <>
                    <label className="plan-task-date">
                      <span>Move to</span>
                      <input
                        type="date"
                        value={targetDates[t.id] || ''}
                        onChange={(event) => setTargetDates((old) => ({ ...old, [t.id]: event.target.value }))}
                      />
                    </label>
                    <Button variant="secondary" onClick={() => act(t.id, 'MOVE')}>
                      Reschedule
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  )
}
