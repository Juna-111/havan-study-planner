'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { Button, Card, EmptyState, ErrorState, ProgressBar } from '@/components/ui'
import { StudentGate } from '@/features/student/StudentGate'
import { getCurrentPlan, type Plan } from '@/lib/plan'
import { apiFetch } from '@/lib/api'
import { EmptyPlanIllustration, StreakIcon } from '@/components/brand/illustrations'
import { getSavedAccount } from '@/lib/auth'
import { getLocalStudyStreak } from '@/lib/studyStreak'

type ExamSummary = {
  id: number
  exam_type: string
  exam_date: string
  course_id: number
}

type CourseSummary = {
  id: number
  code: string
  name: string
}

const localeDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function getDaysUntil(dateValue: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateValue}T00:00:00`)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function formatDaysLeft(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

export default function Home() {
  return (
    <ErrorBoundary>
      <StudentGate><HomeView /></StudentGate>
    </ErrorBoundary>
  )
}

function HomeView() {
  const router = useRouter()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [upcomingExams, setUpcomingExams] = useState<ExamSummary[]>([])
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [streak, setStreak] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextPlan, exams, courseList, studyStreak] = await Promise.all([
        getCurrentPlan(),
        apiFetch<ExamSummary[]>('/students/me/exams').catch(() => []),
        apiFetch<CourseSummary[]>('/students/me/catalog').catch(() => []),
        apiFetch<{ streak: number }>('/students/me/study-streak').catch(() => null),
      ])
      setPlan(nextPlan)
      setUpcomingExams(exams)
      setCourses(courseList)
      const studentId = getSavedAccount()?.student_profile_id
      setStreak(studyStreak?.streak ?? (studentId ? getLocalStudyStreak(studentId) : 0))
      router.refresh()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'We could not load your Havan dashboard. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void reload()
  }, [reload])

  const nextExams = useMemo(() => {
    return [...upcomingExams]
      .filter((exam) => getDaysUntil(exam.exam_date) >= 0)
      .sort((a, b) => getDaysUntil(a.exam_date) - getDaysUntil(b.exam_date))
      .slice(0, 3)
  }, [upcomingExams])

  return (
    <AppShell>
      <header className="home-hero">
        <span className="app-eyebrow">HAVAN</span>
        <h1>What should I do now?</h1>
        <p>You choose what to study. Havan organizes your time.</p>
      </header>

      {error ? (
        <ErrorState onRetry={reload} message={error} />
      ) : (
        <div className="app-grid">
          <Card as="section" padding="lg" className="home-card" style={{ background: 'linear-gradient(135deg, var(--color-primary-soft), var(--color-surface))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <span className="app-eyebrow">STREAK</span>
                <h2 style={{ marginTop: 8, marginBottom: 6 }}>{loading ? 'Loading streak…' : `🔥 ${streak}-day streak`}</h2>
              </div>
              <StreakIcon size={32} />
            </div>
            <p className="app-copy">Keep the rhythm going. One focused session is enough to protect your streak.</p>
            <Button variant="secondary" onClick={() => router.push('/plan')}>Review today</Button>
          </Card>

          <Card as="section" padding="lg" className="home-card">
            <span className="app-eyebrow">EXAM COUNTDOWN</span>
            {loading ? (
              <p className="app-copy">Loading upcoming exams…</p>
            ) : nextExams.length ? (
              <div className="havan-upcoming-exams">
                {nextExams.map((exam) => {
                  const daysLeft = getDaysUntil(exam.exam_date)
                  const course = courses.find((item) => item.id === exam.course_id)
                  const urgency = daysLeft <= 2 ? 'danger' : daysLeft <= 7 ? 'soon' : 'normal'
                  return (
                    <article className={`havan-upcoming-exam havan-upcoming-exam-${urgency}`} key={exam.id}>
                      <div>
                        <strong>{course ? course.name : exam.exam_type}</strong>
                        <span>{exam.exam_type} · {localeDate(exam.exam_date)}</span>
                      </div>
                      <b>{formatDaysLeft(daysLeft)}</b>
                    </article>
                  )
                })}
                <Button variant="accent" onClick={() => router.push('/exam-planning')}>Review exam scope</Button>
              </div>
            ) : (
              <>
                <h2 style={{ marginTop: 8, marginBottom: 6 }}>No exams scheduled</h2>
                <p className="app-copy">Add your next exam on the planning page to keep study priorities clear.</p>
                <Button variant="secondary" onClick={() => router.push('/exam-planning')}>Add an exam</Button>
              </>
            )}
          </Card>

          {plan ? (
            <>
              <Card as="section" padding="lg" className="home-card">
                <h2>{plan.tasks.filter((task) => task.planned_date === plan.start_date).length} tasks for your plan</h2>
                <p className="app-copy">Open the plan to start, complete, skip, or review tasks.</p>
                <Button onClick={() => router.push('/plan')}>Open my plan</Button>
              </Card>

              <Card as="section" padding="lg" className="home-card">
                <h2>{plan.total_minutes} minutes planned</h2>
                <ProgressBar value={plan.total_minutes ? 100 : 0} />
                <p className="app-meta">{plan.unplaced.length} topics currently unplaced.</p>
              </Card>
            </>
          ) : !loading ? (
            <EmptyState
              illustration={<EmptyPlanIllustration />}
              title="No study plan yet"
              hint="Choose the topics you want to study. Havan will organize them around your available time."
              action={<Button onClick={() => router.push('/student/havan')}>Choose study topics</Button>}
            />
          ) : null}
        </div>
      )}
    </AppShell>
  )
}
