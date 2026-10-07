'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell, PageHeader } from '@/components/layout'
import { Button, Card, Chip, EmptyState, ErrorState } from '@/components/ui'
import { getLatestHavanPlan, havanTaskAction, type HavanPlan } from '@/lib/havanPlan'

function criticalPoints(value?: string | null) {
  if (!value?.trim()) return []
  return value.split(/\r?\n|•/).map((item) => item.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
}

export default function HavanPlanView() {
  const [plan, setPlan] = useState<HavanPlan | null>(null)
  const [error, setError] = useState('')
  const [busyTask, setBusyTask] = useState<number | null>(null)

  useEffect(() => {
    getLatestHavanPlan().then(setPlan).catch((value) => setError(value instanceof Error ? value.message : 'Could not load your Havan plan.'))
  }, [])

  const grouped = useMemo(() => {
    if (!plan) return []
    const groups = new Map<string, HavanPlan['tasks']>()
    for (const task of plan.tasks) groups.set(task.planned_date, [...(groups.get(task.planned_date) ?? []), task])
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [plan])

  async function action(taskId: number, actionName: 'START' | 'COMPLETE') {
    if (!plan || busyTask !== null) return
    setBusyTask(taskId)
    try {
      setPlan(await havanTaskAction(plan.id as number, taskId, actionName))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not update that study task.')
    } finally {
      setBusyTask(null)
    }
  }

  if (error && !plan) {
    return <AppShell><ErrorState message={error} onRetry={() => window.location.reload()} /></AppShell>
  }

  if (!plan) {
    return <AppShell><EmptyState title="No Havan plan yet" hint="Choose Today, Week, or Month, select your topics, and create your first Havan plan." action={<Link href="/student/havan"><Button>Build my Havan plan</Button></Link>} /></AppShell>
  }

  const done = plan.tasks.filter((task) => task.status === 'DONE').length
  const progress = plan.tasks.length ? Math.round((done / plan.tasks.length) * 100) : 0

  return (
    <AppShell header={<PageHeader title="Your Havan plan" description="Only the courses, chapters, and topics you selected are here. Havan only allocated the time you gave it." backHref="/student/havan" />}>
      <div className="havan-plan-view">
        {(plan.warnings.length > 0 || plan.unplaced.length > 0) && (
          <Card padding="lg" className="havan-plan-feedback">
            <span className="app-eyebrow">BUILD CHECK</span>
            <h2>Havan kept your choices intact</h2>
            {plan.warnings.map((warning) => (
              <p className="havan-plan-feedback-item" key={warning.code}>{warning.message}</p>
            ))}
            {plan.unplaced.length > 0 && (
              <div className="havan-plan-unplaced">
                <strong>Still needs time</strong>
                {plan.unplaced.map((item) => (
                  <span key={item.topic_id}>{item.topic_name} · {item.minutes} min remaining</span>
                ))}
              </div>
            )}
          </Card>
        )}

        <Card padding="lg" className="havan-plan-overview">
          <div>
            <span className="app-eyebrow">HAVAN {plan.mode.toUpperCase()}</span>
            <h2>{plan.total_minutes} minutes organised</h2>
            <p>{done} of {plan.tasks.length} study tasks completed · {progress}% complete</p>
          </div>
          <Link href={'/student/havan/' + plan.mode}><Button variant="secondary">Build another plan</Button></Link>
        </Card>

        {error && <p className="havan-plan-error" role="alert">{error}</p>}

        {grouped.map(([date, tasks]) => (
          <section className="havan-plan-day" key={date}>
            <div className="havan-plan-day-heading"><h2>{date}</h2><span>{tasks.reduce((sum, task) => sum + task.minutes, 0)} min</span></div>
            {tasks.map((task) => {
              const points = criticalPoints(task.important_points)
              return (
                <Card padding="lg" className="havan-plan-task" key={task.id}>
                  <div className="havan-plan-task-top">
                    <Chip tone={task.status === 'DONE' ? 'success' : task.status === 'IN_PROGRESS' ? 'info' : 'neutral'}>
                      {task.status === 'DONE' ? 'Completed' : task.status === 'IN_PROGRESS' ? 'In progress' : 'Planned'}
                    </Chip>
                    <strong>{task.minutes} min</strong>
                  </div>
                  <span className="havan-plan-course">{task.course_code} · {task.course_name}</span>
                  <span className="havan-plan-chapter">{task.chapter_name}</span>
                  <h3>{task.topic_name}</h3>
                  <p>You selected this topic. Havan allocated part of your available study time to it using its estimated study time.</p>

                  {points.length > 0 && (
                    <div className="havan-plan-points">
                      <strong>Critical points</strong>
                      <ul>{points.map((point, index) => <li key={index}>{point}</li>)}</ul>
                    </div>
                  )}

                  {task.promotions.length > 0 && (
                    <div className="havan-plan-promotions">
                      <div className="havan-plan-promotions-heading"><span className="app-eyebrow">HAVAN</span><strong>Learn More With Havan</strong></div>
                      <div className="havan-plan-promotion-links">
                        {task.promotions.map((promotion) => (
                          <a key={promotion.id} href={promotion.url} target="_blank" rel="noreferrer" className="havan-plan-promotion">
                            <span><strong>{promotion.platform_name}</strong>{promotion.description && <small>{promotion.description}</small>}</span>
                            <b>{promotion.button_text} ↗</b>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="havan-plan-task-actions">
                    {task.status === 'PLANNED' && <Button variant="accent" loading={busyTask === task.id} onClick={() => void action(task.id, 'START')}>Start focus</Button>}
                    {task.status !== 'DONE' && <Button variant="secondary" loading={busyTask === task.id} onClick={() => void action(task.id, 'COMPLETE')}>Complete</Button>}
                    {task.status === 'DONE' && <span className="havan-plan-complete-note">Study task completed.</span>}
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
