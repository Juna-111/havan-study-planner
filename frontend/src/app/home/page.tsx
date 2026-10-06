'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { Button, Card, EmptyState, ErrorState, ProgressBar } from '@/components/ui'
import { StudentGate } from '@/features/student/StudentGate'
import { getCurrentPlan, type Plan } from '@/lib/plan'

export default function Home() {
  return <StudentGate><HomeView /></StudentGate>
}

function HomeView() {
  const router = useRouter()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getCurrentPlan()
      .then(setPlan)
      .catch((value) => setError(value instanceof Error ? value.message : 'Could not load your plan.'))
  }, [])

  return (
    <AppShell>
      <header className="home-hero">
        <span className="app-eyebrow">HAVAN</span>
        <h1>What should I do now?</h1>
        <p>You choose what to study. Havan organizes your time.</p>
      </header>

      {error ? (
        <ErrorState onRetry={() => location.reload()} message={error} />
      ) : !plan ? (
        <EmptyState
          title="No study plan yet"
          hint="Choose the topics you want to study. Havan will organize them around your available time."
          action={<Button onClick={() => router.push('/student/havan')}>Choose study topics</Button>}
        />
      ) : (
        <div className="app-grid">
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
