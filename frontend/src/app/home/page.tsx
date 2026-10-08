'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { Button, Card, EmptyState, ErrorState, ProgressBar } from '@/components/ui'
import { StudentGate } from '@/features/student/StudentGate'
import { getCurrentPlan, type Plan } from '@/lib/plan'
import { apiFetch } from '@/lib/api'
import { EmptyPlanIllustration, StreakIcon } from '@/components/brand/illustrations'

type ExamSummary = {
  id: number
  exam_type: string
  exam_date: string
  course_id: number
  course_name?: string
}

const localeDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function getDaysUntil(dateValue: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateValue}T00:00:00`)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function buildStudyStreak(tasks: Plan['tasks']) {
  const doneDates = new Set(tasks.filter((task) => task.status === 'DONE').map((task) => task.planned_date))
  const today = new Date()
  let streak = 0

  for (let offset = 0; offset < 365; offset += 1) {
    const cursor = new Date(today)
    cursor.setDate(today.getDate() - offset)
    const key = cursor.toISOString().slice(0, 10)
    if (doneDates.has(key)) {
      streak += 1
      continue
    }
    if (offset === 0) {
      break
    }
    break
  }

  return streak
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
  const [error, setError] = useState('')

  const reload = () => {
    Promise.all([
      getCurrentPlan(),
      apiFetch<ExamSummary[]>('/students/me/exams').catch(() => []),
    ])
      .then(([nextPlan, exams]) => {
        setPlan(nextPlan)
        setUpcomingExams(exams)
      })
      .then(() => router.refresh())
      .catch((value) => setError(value instanceof Error ? value.message : 'We could not load your Havan dashboard. Please try again.'))
  }

  useEffect(() => {
    Promise.all([
      getCurrentPlan(),
      apiFetch<ExamSummary[]>('/students/me/exams').catch(() => []),
    ])
      .then(([nextPlan, exams]) => {
        setPlan(nextPlan)
        setUpcomingExams(exams)
      })
      .catch((value) => setError(value instanceof Error ? value.message : 'We could not load your Havan dashboard. Please try again.'))
  }, [])

  const streak = useMemo(() => {
    const computed = plan ? buildStudyStreak(plan.tasks) : 0
    if (typeof window !== 'undefined') {
      const stored = Number(window.localStorage.getItem('havan-study-streak') ?? '0')
      window.localStorage.setItem('havan-study-streak', String(Math.max(computed, stored)))
    }
    return computed || Number(typeof window !== 'undefined' ? (window.localStorage.getItem('havan-study-streak') ?? '0') : 0)
  }, [plan])

  const nextExam = useMemo(() => {
    return [...upcomingExams]
      .filter((exam) => getDaysUntil(exam.exam_date) >= 0)
      .sort((a, b) => getDaysUntil(a.exam_date) - getDaysUntil(b.exam_date))[0] ?? null
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
      ) : !plan ? (
        <EmptyState
          illustration={<EmptyPlanIllustration />}
          title="No study plan yet"
          hint="Choose the topics you want to study. Havan will organize them around your available time."
          action={<Button onClick={() => router.push('/student/havan')}>Choose study topics</Button>}
        />
      ) : (
        <div className="app-grid">
          <Card as="section" padding="lg" className="home-card" style={{ background: 'linear-gradient(135deg, var(--color-primary-soft), var(--color-surface))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <span className="app-eyebrow">STREAK</span>
                <h2 style={{ marginTop: 8, marginBottom: 6 }}>🔥 {streak}-day streak</h2>
              </div>
              <StreakIcon size={32} />
            </div>
            <p className="app-copy">Keep the rhythm going. One focused session is enough to protect your streak.</p>
            <Button variant="secondary" onClick={() => router.push('/plan')}>Review today</Button>
          </Card>

          <Card as="section" padding="lg" className="home-card">
            <span className="app-eyebrow">EXAM COUNTDOWN</span>
            {nextExam ? (
              <>
                <h2 style={{ marginTop: 8, marginBottom: 6 }}>{getDaysUntil(nextExam.exam_date)} days left</h2>
                <p className="app-copy">{nextExam.exam_type} • {localeDate(nextExam.exam_date)}</p>
                <Button variant="accent" onClick={() => router.push('/exam-planning')}>Review exam scope</Button>
              </>
            ) : (
              <>
                <h2 style={{ marginTop: 8, marginBottom: 6 }}>No exams scheduled</h2>
                <p className="app-copy">Add your next exam on the planning page to keep study priorities clear.</p>
                <Button variant="secondary" onClick={() => router.push('/exam-planning')}>Add an exam</Button>
              </>
            )}
          </Card>

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
        </div>
      )}
    </AppShell>
  )
}
