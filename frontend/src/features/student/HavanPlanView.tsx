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

                  <div className="havan-plan-resources">
                    <div className="havan-plan-resources-heading">
                      <div>
                        <span className="app-eyebrow">HAVAN ACADEMY</span>
                        <strong>Learn this topic with Havan</strong>
                      </div>
                      <span className="havan-plan-resource-badge">Topic resources</span>
                    </div>
                    {(task.academy_video_url || task.academy_notes_url || task.academy_questions_url) ? (
                      <>
                        <p>Use the published Havan Academy material for this exact topic. No unrelated resources are mixed into your plan.</p>
                        <div className="havan-plan-resource-grid">
                          {task.academy_video_url && (
                            <a className="havan-plan-resource-card" href={task.academy_video_url} target="_blank" rel="noreferrer">
                              <span className="havan-plan-resource-card-type">COURSE</span>
                              <strong>Course video</strong>
                              <span>Watch the Havan Academy lesson for this topic.</span>
                              <span className="havan-plan-resource-card-action">Open video ↗</span>
                            </a>
                          )}
                          {task.academy_notes_url && (
                            <a className="havan-plan-resource-card" href={task.academy_notes_url} target="_blank" rel="noreferrer">
                              <span className="havan-plan-resource-card-type">NOTES</span>
                              <strong>Study notes</strong>
                              <span>Review the key material before or after your study session.</span>
                              <span className="havan-plan-resource-card-action">Open notes ↗</span>
                            </a>
                          )}
                          {task.academy_questions_url && (
                            <a className="havan-plan-resource-card" href={task.academy_questions_url} target="_blank" rel="noreferrer">
                              <span className="havan-plan-resource-card-type">PRACTICE</span>
                              <strong>Freshman Exam Questions</strong>
                              <span>Practice questions linked to this topic{task.freshman_question_count ? ` · ${task.freshman_question_count} available` : ''}.</span>
                              <span className="havan-plan-resource-card-action">Open questions ↗</span>
                            </a>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="havan-plan-resource-empty">
                        <strong>Not published yet</strong>
                        <span>Video, notes, and Freshman Exam Questions will appear here when Havan Academy publishes them for this topic.</span>
                      </div>
                    )}
                  </div>

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
