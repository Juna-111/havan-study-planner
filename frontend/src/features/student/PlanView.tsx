'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/layout'
import { Button, Card, Chip, EmptyState, ErrorState, StatusBadge } from '@/components/ui'
import { getCurrentPlan, planAction, type Plan } from '@/lib/plan'
import { apiFetch } from '@/lib/api'
import { EmptyPlanIllustration } from '@/components/brand/illustrations'
import { getSavedAccount } from '@/lib/auth'
import { recordLocalStudyCompletion } from '@/lib/studyStreak'
import { useFocusSession } from './useFocusSession'
export default function PlanView() {
  const router = useRouter()
  const [p, setP] = useState<Plan | null>(null)
  const [e, setE] = useState('')
  const [targetDates, setTargetDates] = useState<Record<number, string>>({})
  const [pendingTask, setPendingTask] = useState<number | null>(null)
  const [catalog, setCatalog] = useState<{ id: number; code: string; name: string; chapters: { id: number; name: string; topics: { id: number; name: string }[] }[] }[]>([])
  const [addTopicId, setAddTopicId] = useState('')
  const [addError, setAddError] = useState('')
  const [celebratingTask, setCelebratingTask] = useState<number | null>(null)
  const [addedTask, setAddedTask] = useState<number | null>(null)
  const focus = useFocusSession()

  const reload = () => {
    setE('')
    getCurrentPlan()
      .then(setP)
      .then(() => router.refresh())
      .catch((x) => setE(x instanceof Error ? x.message : ''))
  }

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
      label: course.name + ' · ' + chapter.name + ' · ' + topic.name,
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
  const focusedTask = p?.tasks.find((task) => task.id === focus.session?.taskId) ?? null

  const startFocus = async (task: Plan['tasks'][number]) => {
    if (pendingTask !== null || focus.session) return
    try {
      setE('')
      setPendingTask(task.id)
      let nextPlan = p
      if (task.status === 'PLANNED') {
        nextPlan = await planAction(task.id, { action: 'START' })
        setP(nextPlan)
      }
      const minutes = Math.max(5, task.minutes)
      focus.start(task.id, `${task.course_name}: ${task.topic_name}`, minutes)
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Could not start Focus mode.')
    } finally {
      setPendingTask(null)
    }
  }

  const finishFocus = async () => {
    if (!focusedTask || !focus.session || pendingTask !== null) return
    const elapsedMinutes = Math.max(
      1,
      Math.min(focus.session.minutes, focus.session.minutes - Math.ceil(focus.remainingSeconds / 60)),
    )
    try {
      setE('')
      setPendingTask(focusedTask.id)
      const nextPlan = await planAction(focusedTask.id, {
        action: 'COMPLETE',
        actual_minutes: elapsedMinutes,
      })
      setP(nextPlan)
      const studentId = getSavedAccount()?.student_profile_id
      if (studentId) recordLocalStudyCompletion(studentId)
      focus.clear()
      setCelebratingTask(focusedTask.id)
      window.setTimeout(() => setCelebratingTask(null), 650)
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Could not save the Focus session.')
    } finally {
      setPendingTask(null)
    }
  }

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
      const nextPlan = await planAction(id, { action, target_date })
      setP(nextPlan)
      if (action === 'COMPLETE') {
        const studentId = getSavedAccount()?.student_profile_id
        if (studentId) recordLocalStudyCompletion(studentId)
      }
      if (action === 'COMPLETE' || action === 'START') {
        setCelebratingTask(id)
        window.setTimeout(() => setCelebratingTask(null), 650)
      }
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
          <Button variant="secondary" onClick={() => router.replace('/student/havan')}>
            Change selected topics
          </Button>
        }
      />
      {e ? (
        <ErrorState onRetry={reload} message={e} />
      ) : !p ? (
        <EmptyState
          illustration={<EmptyPlanIllustration />}
          title="No plan yet"
          hint="Choose the course, chapter, and topics you want Havan to organize."
          action={
            <Button variant="accent" onClick={() => router.replace('/student/havan')}>
              Build a plan
            </Button>
          }
        />
      ) : (
        <div className="stack">
          <Card padding="lg" className="plan-overview havan-motion-enter">
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
          <Card padding="lg" className="plan-add-topic havan-motion-enter" style={{ '--motion-delay': '70ms' } as React.CSSProperties}>
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
                    const selectedTopicId = Number(addTopicId)
                    const nextPlan = await planAction(0, { action: 'ADD', target_topic_id: selectedTopicId })
                    setP(nextPlan)
                    const added = nextPlan.tasks.find((task) => task.topic_id === selectedTopicId)
                    if (added) {
                      setAddedTask(added.id)
                      window.setTimeout(() => setAddedTask(null), 700)
                    }
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
            <section className="plan-day havan-motion-enter" key={date}>
              <div className="plan-day-heading">
                <h2>{date}</h2>
                <span>{tasks.reduce((total, task) => total + task.minutes, 0)} min</span>
              </div>
              {tasks.map((t, index) => (
                <Card key={t.id} as="article" padding="lg" className={`plan-task havan-task-card ${celebratingTask === t.id ? 'havan-task-celebrate' : ''} ${addedTask === t.id ? 'havan-task-added' : ''}`} style={{ '--motion-delay': `${index * 65}ms` } as React.CSSProperties}>
                  <div className="row">
                    <StatusBadge status={t.status} />
                    <strong>{t.planned_date}</strong>
                  </div>
                  <div className="plan-task-chapter">{t.chapter_name}</div><h2 className="plan-task-title">{t.topic_name}</h2>
                  <p>{t.reason}</p>
                  <small>
                    {t.minutes} min · {t.course_name}
                  </small>
                  <div className="plan-focus-row">
                    {focus.session?.taskId === t.id ? (
                      <div className="plan-focus-panel">
                        <div>
                          <span className="app-eyebrow">HAVAN FOCUS</span>
                          <div className="plan-focus-time-control"><span>Session</span><button type="button" aria-label="Decrease focus minutes" disabled={focus.session.minutes <= 5 || pendingTask !== null || focus.session.completed} onClick={() => focus.adjust(-5)}>−</button><strong>{focus.session.minutes} min</strong><button type="button" aria-label="Increase focus minutes" disabled={focus.session.minutes >= 120 || pendingTask !== null || focus.session.completed} onClick={() => focus.adjust(5)}>+</button></div>
                          <strong>{String(Math.floor(focus.remainingSeconds / 60)).padStart(2, '0')}:{String(focus.remainingSeconds % 60).padStart(2, '0')}</strong>
                          <small>{focus.session.completed ? 'Focus time is complete. Save your progress when ready.' : focus.session.running ? 'This session keeps time while you move around Havan.' : 'Focus is paused.'}</small>
                          <a className="focus-notification-enable" href="/settings">Set up background notifications in Settings</a>
                        </div>
                        <div className="plan-focus-actions">
                          {!focus.session.completed && focus.remainingSeconds > 0 && (
                            <Button
                              variant="accent"
                              disabled={pendingTask === t.id}
                              onClick={() => focus.session?.running ? focus.pause() : focus.resume()}
                            >
                              {focus.session.running ? 'Pause' : 'Resume'}
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            disabled={pendingTask === t.id}
                            onClick={finishFocus}
                          >
                            {pendingTask === t.id ? 'Saving...' : 'Finish focus'}
                          </Button>
                        </div>
                      </div>
                    ) : t.status !== 'DONE' ? (
                      <Button
                        variant="accent"
                        disabled={pendingTask !== null || !!focus.session}
                        onClick={() => startFocus(t)}
                      >
                        {focus.session ? 'Another focus is active' : 'Focus'}
                      </Button>
                    ) : null}
                  </div>
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
