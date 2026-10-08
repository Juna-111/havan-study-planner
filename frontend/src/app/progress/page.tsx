'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/layout'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { Card, EmptyState, ErrorState, ProgressBar } from '@/components/ui'
import { StudentGate } from '@/features/student/StudentGate'
import { apiFetch } from '@/lib/api'
import { EmptyPlanIllustration } from '@/components/brand/illustrations'

type Row = { topic_id: number; topic_name?: string; status?: string; course_name?: string }

export default function Progress() {
  return (
    <ErrorBoundary>
      <StudentGate><View /></StudentGate>
    </ErrorBoundary>
  )
}

function View() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  const reload = () => {
    setError('')
    apiFetch<Row[]>('/students/me/progress')
      .then(setRows)
      .then(() => router.refresh())
      .catch((value) => setError(value instanceof Error ? value.message : 'Could not load progress.'))
  }

  useEffect(() => {
    apiFetch<Row[]>('/students/me/progress')
      .then(setRows)
      .catch((value) => setError(value instanceof Error ? value.message : 'Could not load progress.'))
  }, [])

  const completed = rows.filter((row) => String(row.status).toUpperCase() === 'COMPLETED').length

  return (
    <AppShell>
      <PageHeader title="Progress" description="See what you have completed without turning study into a scoreboard." />
      {error ? <ErrorState onRetry={reload} message={error} /> : !rows.length ? (
        <EmptyState
          illustration={<EmptyPlanIllustration />}
          title="No progress yet"
          hint="Complete study tasks and your progress will appear here."
        />
      ) : (
        <div className="app-section">
          <Card padding="lg">
            <ProgressBar value={rows.length ? (completed / rows.length) * 100 : 0} label="Topics completed" />
            <p className="app-meta progress-copy">{completed} of {rows.length} tracked topics completed.</p>
          </Card>
          <div className="progress-list">
            {rows.map((row) => (
              <Card key={row.topic_id} padding="md" className="progress-item">
                <div className="topic-row">
                  <strong>{row.topic_name ?? `Topic ${row.topic_id}`}</strong>
                  <span className="app-meta">{String(row.status ?? '').toUpperCase()}</span>
                </div>
                <small className="app-meta">{row.course_name ?? 'Course'}</small>
              </Card>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  )
}
