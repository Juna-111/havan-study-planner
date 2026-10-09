'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell, PageHeader } from '@/components/layout'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ProgressBar,
  Skeleton,
  StatusBadge,
} from '@/components/ui'
import { getLatestHavanPlan, havanTaskAction, type HavanPlan } from '@/lib/havanPlan'
import { getSavedAccount } from '@/lib/auth'
import { recordLocalStudyCompletion } from '@/lib/studyStreak'

type LoadState = 'loading' | 'empty' | 'error' | 'ready'

function criticalPoints(value?: string | null) {
  if (!value?.trim()) return []
  return value
    .split(/\r?\n|•/)
    .map((item) => item.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

function PlanSkeleton() {
  return (
    <div className="havan-plan-skeleton" aria-label="Loading your Havan plan">
      <Card padding="lg">
        <Skeleton width="34%" height={16} />
        <Skeleton width="62%" height={30} />
        <Skeleton width="48%" height={16} />
      </Card>
      {[1, 2, 3].map((item) => (
        <Card padding="lg" key={item}>
          <Skeleton width="28%" height={14} />
          <Skeleton width="72%" height={22} />
          <Skeleton width="42%" height={14} />
          <Skeleton width="92%" height={12} />
        </Card>
      ))}
    </div>
  )
}

export default function HavanPlanView() {
  const [plan, setPlan] = useState<HavanPlan | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState('')
  const [busyTask, setBusyTask] = useState<number | null>(null)
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null)
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [focusSeconds, setFocusSeconds] = useState(0)
  const [focusRunning, setFocusRunning] = useState(false)

  const loadPlan = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const latest = await getLatestHavanPlan()
      if (!latest) {
        setPlan(null)
        setState('empty')
        return
      }
      setPlan(latest)
      setState('ready')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load your Havan plan.')
      setState('error')
    }
  }, [])

  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  useEffect(() => {
    if (!focusRunning || focusTaskId === null) return
    const timer = window.setTimeout(() => {
      if (focusSeconds <= 1) {
        setFocusSeconds(0)
        setFocusRunning(false)
      } else {
        setFocusSeconds(focusSeconds - 1)
      }
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [focusRunning, focusTaskId, focusSeconds])

  const grouped = useMemo(() => {
    if (!plan) return []
    const groups = new Map<string, HavanPlan['tasks']>()
    for (const task of plan.tasks) {
      groups.set(
        task.planned_date,
        [...(groups.get(task.planned_date) ?? []), task],
      )
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [plan])

  async function action(
    taskId: number,
    actionName: 'START' | 'COMPLETE',
    actualMinutes?: number,
  ): Promise<boolean> {
    if (!plan || busyTask !== null) return false
    setBusyTask(taskId)
    setError('')
    try {
      setPlan(await havanTaskAction(plan.id as number, taskId, actionName, actualMinutes))
      if (actionName === 'COMPLETE') {
        const studentId = getSavedAccount()?.student_profile_id
        if (studentId) recordLocalStudyCompletion(studentId)
      }
      return true
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : 'Could not update that study task.',
      )
      return false
    } finally {
      setBusyTask(null)
    }
  }

  function openFocus(taskId: number, plannedMinutes: number) {
    const minutes = Math.max(5, Math.min(120, plannedMinutes))
    setFocusTaskId(taskId)
    setFocusMinutes(minutes)
    setFocusSeconds(minutes * 60)
    setFocusRunning(false)
  }

  async function finishFocus() {
    if (focusTaskId === null || busyTask !== null) return
    const elapsedMinutes = Math.ceil((focusMinutes * 60 - focusSeconds) / 60)
    if (elapsedMinutes < 1) return
    if (await action(focusTaskId, 'COMPLETE', elapsedMinutes)) {
      setFocusTaskId(null)
      setFocusSeconds(0)
      setFocusRunning(false)
    }
  }

  function cancelFocus() {
    setFocusTaskId(null)
    setFocusSeconds(0)
    setFocusRunning(false)
  }

  if (state === 'loading') {
    return <AppShell><PlanSkeleton /></AppShell>
  }

  if (state === 'error') {
    return (
      <AppShell>
        <ErrorState message={error} onRetry={() => void loadPlan()} />
      </AppShell>
    )
  }

  if (state === 'empty') {
    return (
      <AppShell>
        <EmptyState
          title="Your Havan plan is empty"
          hint="Choose your topics and study time, then Havan will organise them into a clear plan."
          action={
            <Link href="/student/havan">
              <Button>Build my Havan plan</Button>
            </Link>
          }
        />
      </AppShell>
    )
  }

  if (!plan) return null

  const done = plan.tasks.filter((task) => task.status === 'DONE').length
  const progress = plan.tasks.length
    ? Math.round((done / plan.tasks.length) * 100)
    : 0

  return (
    <AppShell
      header={
        <PageHeader
          title="Your Havan plan"
          description="Only the topics you selected are here. Havan organised the time you gave it."
          backHref="/student/havan"
        />
      }
    >
      <div className="havan-plan-view">
        {(plan.warnings.length > 0 || plan.unplaced.length > 0) && (
          <Card padding="lg" className="havan-plan-feedback">
            <span className="app-eyebrow">PLAN CHECK</span>
            <h2>One or more choices need attention</h2>
            {plan.warnings.map((warning) => (
              <div
                className={`havan-plan-warning havan-plan-warning-${warning.severity}`}
                key={warning.code}
              >
                <p>{warning.message || 'Review this part of your plan.'}</p>
                {Object.entries(warning.fix ?? {}).map(([key, label]) => (
                  <Link
                    className="havan-plan-warning-action"
                    href={key === 'keep' ? '#' : `/student/havan/${plan.mode}`}
                    key={key}
                    onClick={key === 'keep' ? (event) => event.preventDefault() : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            ))}
            {plan.unplaced.length > 0 && (
              <div className="havan-plan-unplaced">
                <strong>Not scheduled yet</strong>
                {plan.unplaced.map((item) => (
                  <div key={item.topic_id}>
                    <span>{item.topic_name}</span>
                    <small>{item.minutes} min still needs a place.</small>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <Card padding="lg" className="plan-overview">
          <div>
            <span className="app-eyebrow">HAVAN {plan.mode.toUpperCase()}</span>
            <h2>{plan.total_minutes} minutes organised</h2>
            <p>{done} of {plan.tasks.length} study tasks completed</p>
            <ProgressBar value={progress} label="Plan progress" />
          </div>
          <Link href={`/student/havan/${plan.mode}`}>
            <Button variant="secondary">Build another plan</Button>
          </Link>
        </Card>

        {error && <p className="havan-plan-error" role="alert">{error}</p>}

        {grouped.map(([date, tasks]) => (
          <section className="plan-day" key={date}>
            <div className="plan-day-heading">
              <h2>{date}</h2>
              <span>{tasks.reduce((sum, task) => sum + task.minutes, 0)} min</span>
            </div>
            {tasks.map((task) => {
              const points = criticalPoints(task.important_points)
              return (
                <Card padding="lg" className="plan-task" key={task.id}>
                  <div className="havan-plan-task-top">
                    <StatusBadge status={task.status} />
                    <strong>{task.minutes} min</strong>
                  </div>
                  <span className="havan-plan-course">
                    {task.course_name}
                  </span>
                  <span className="havan-plan-chapter">{task.chapter_name}</span>
                  <h3 className="plan-task-title">{task.topic_name}</h3>
                  {points.length > 0 && (
                    <div className="havan-plan-points">
                      <strong>Critical points</strong>
                      <ul>{points.map((point, index) => <li key={index}>{point}</li>)}</ul>
                    </div>
                  )}

                  {task.promotions.length > 0 && (
                    <div className="havan-plan-promotions" aria-label="Havan study promotion">
                      <div className="havan-plan-promotions-heading">
                        <span className="app-eyebrow">HAVAN</span>
                        <strong>Learn more with Havan</strong>
                      </div>
                      <div className="havan-plan-promotion-links">
                        {task.promotions.map((promotion) => (
                          <a
                            key={promotion.id}
                            href={promotion.url}
                            target="_blank"
                            rel="noreferrer"
                            className="havan-plan-promotion"
                          >
                            <span>
                              <strong>{promotion.platform_name}</strong>
                              {promotion.description && <small>{promotion.description}</small>}
                            </span>
                            <b>{promotion.button_text} ↗</b>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {focusTaskId === task.id && (
                    <section className="havan-focus-panel" aria-label={`Focus timer for ${task.topic_name}`}>
                      <div className="havan-focus-heading">
                        <div>
                          <span className="app-eyebrow">FOCUS TIMER</span>
                          <strong>{task.topic_name}</strong>
                        </div>
                        <strong className="havan-focus-clock" role="timer" aria-live="off">
                          {String(Math.floor(focusSeconds / 60)).padStart(2, '0')}:{String(focusSeconds % 60).padStart(2, '0')}
                        </strong>
                      </div>
                      <div className="havan-focus-duration">
                        <span>Session length</span>
                        <div>
                          <button
                            type="button"
                            aria-label="Decrease focus session by five minutes"
                            disabled={focusMinutes <= 5 || focusRunning}
                            onClick={() => {
                              const next = Math.max(5, focusMinutes - 5)
                              setFocusMinutes(next)
                              setFocusSeconds((seconds) => Math.min(seconds, next * 60))
                            }}
                          >
                            −
                          </button>
                          <strong>{focusMinutes} min</strong>
                          <button
                            type="button"
                            aria-label="Increase focus session by five minutes"
                            disabled={focusMinutes >= 120 || focusRunning}
                            onClick={() => {
                              const next = Math.min(120, focusMinutes + 5)
                              setFocusMinutes(next)
                              setFocusSeconds((seconds) => seconds + 300)
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p role="status">
                        {focusSeconds === 0
                          ? 'Session time is up. Finish the session to save it.'
                          : focusRunning
                            ? 'Stay with this topic. Your time will be saved when you finish.'
                            : focusSeconds === focusMinutes * 60
                              ? 'Start the timer when you are ready to study.'
                              : 'Timer paused. Resume when you are ready.'}
                      </p>
                      <div className="havan-focus-actions">
                        <Button
                          variant="accent"
                          disabled={focusSeconds === 0}
                          onClick={() => setFocusRunning((running) => !running)}
                        >
                          {focusRunning ? 'Pause' : focusSeconds === focusMinutes * 60 ? 'Start timer' : 'Resume'}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busyTask !== null || focusSeconds === focusMinutes * 60}
                          loading={busyTask === task.id}
                          onClick={() => void finishFocus()}
                        >
                          Finish focus
                        </Button>
                        <Button variant="ghost" disabled={busyTask !== null} onClick={cancelFocus}>
                          Cancel
                        </Button>
                      </div>
                    </section>
                  )}

                  <div className="plan-task-actions">
                    {task.status === 'PLANNED' && (
                      <Button
                        variant="secondary"
                        loading={busyTask === task.id}
                        disabled={focusTaskId === task.id}
                        onClick={() => void action(task.id as number, 'START')}
                      >
                        Start
                      </Button>
                    )}
                    {task.status !== 'DONE' && focusTaskId !== task.id && (
                      <Button
                        variant="accent"
                        disabled={busyTask !== null}
                        onClick={() => openFocus(task.id as number, task.minutes)}
                      >
                        Start focus
                      </Button>
                    )}
                    {task.status !== 'DONE' && (
                      <Button
                        variant="secondary"
                        loading={busyTask === task.id}
                        disabled={focusTaskId === task.id}
                        onClick={() => void action(task.id as number, 'COMPLETE')}
                      >
                        Complete
                      </Button>
                    )}
                    {task.status === 'DONE' && (
                      <span className="havan-plan-complete-note">Study task completed.</span>
                    )}
                  </div>
                </Card>
              )
            })}
          </section>
        ))}
      </div>
    </AppShell>
  )
}
