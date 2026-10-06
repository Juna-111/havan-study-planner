'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell, PageHeader, StickyActionBar } from '@/components/layout'
import { Button, Card, Checkbox, EmptyState, ErrorState, NumberStepper, Segmented } from '@/components/ui'
import { StudentGate } from '@/features/student/StudentGate'
import { apiFetch } from '@/lib/api'
import { previewPlan, savePlan, type Plan, type PlanMode } from '@/lib/plan'

type Topic = {
  id: number
  name: string
  difficulty: number
  estimated_study_minutes: number
  important_points?: string | null
  status: string
}

type Chapter = { id: number; name: string; topics: Topic[] }
type Course = { id: number; code: string; name: string; chapters: Chapter[] }
type Profile = { study_hours_per_day: number; study_days: string[] }

export default function NewPlan() {
  return <StudentGate><Builder /></StudentGate>
}

function Builder() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [known, setKnown] = useState<Set<number>>(new Set())
  const [mode, setMode] = useState<PlanMode>('week')
  const [hours, setHours] = useState(2)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Plan | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<Course[]>('/students/me/catalog'),
      apiFetch<Profile>('/students/me/profile'),
    ])
      .then(([catalog, student]) => {
        setCourses(catalog)
        setProfile(student)
        setHours(student.study_hours_per_day)
      })
      .catch((value) => setError(value instanceof Error ? value.message : 'Could not load your study data.'))
  }, [])

  const horizon = mode === 'today' ? 1 : mode === 'week' ? 7 : 28
  const minutesByDay = useMemo(
    () => Object.fromEntries((profile?.study_days ?? []).map((day) => [day, hours * 60])),
    [profile?.study_days, hours],
  )

  const input = useMemo(() => ({
    mode,
    horizon_days: horizon,
    topic_ids: [...selected],
    known_topic_ids: [...known],
    study_days: profile?.study_days ?? [],
    minutes_by_weekday: minutesByDay,
    hours_per_day: hours,
  }), [mode, horizon, selected, known, profile?.study_days, minutesByDay, hours])

  async function previewIt() {
    try {
      setError('')
      setPreview(await previewPlan(input))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not preview your plan.')
    }
  }

  async function saveIt() {
    try {
      setError('')
      await savePlan(input)
      router.push('/plan')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save your plan.')
    }
  }

  return (
    <AppShell>
      <PageHeader title="Build your plan" backHref="/plan" description="Choose the topics. Havan organizes the time." />

      <Card padding="lg" className="app-section">
        <Segmented options={['today', 'week', 'month'] as const} value={mode} onChange={setMode} />
        <NumberStepper label="Hours per study day" value={hours} min={1} max={12} onChange={setHours} />
      </Card>

      {error && <ErrorState message={error} onRetry={() => setError('')} />}

      {!courses.length && !error ? (
        <EmptyState title="No topics available" hint="Your selected courses do not have active topic data yet." />
      ) : (
        <div className="app-section">
          {courses.map((course) => (
            <Card key={course.id} padding="lg" className="plan-course">
              <div>
                <h2>{course.code} · {course.name}</h2>
                <p className="app-meta">Select the topics you want Havan to schedule.</p>
              </div>

              {course.chapters.map((chapter) => (
                <section key={chapter.id} className="plan-chapter">
                  <h3>{chapter.name}</h3>
                  <div className="topic-list">
                    {chapter.topics.map((topic) => (
                      <div key={topic.id} className="plan-topic-row">
                        <Checkbox
                          label={topic.name}
                          checked={selected.has(topic.id)}
                          onChange={(checked) => setSelected((old) => {
                            const next = new Set(old)
                            checked ? next.add(topic.id) : next.delete(topic.id)
                            return next
                          })}
                        />
                        <div className="topic-actions">
                          <span>{topic.estimated_study_minutes} min</span>
                          <Checkbox
                            label="Known"
                            checked={known.has(topic.id)}
                            onChange={(checked) => setKnown((old) => {
                              const next = new Set(old)
                              checked ? next.add(topic.id) : next.delete(topic.id)
                              return next
                            })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </Card>
          ))}

          {preview && (
            <Card padding="lg" className="plan-review">
              <h2>Review</h2>
              <p className="app-copy">
                {preview.total_minutes} minutes placed. {preview.unplaced.length} topics could not fit.
              </p>
              {preview.warnings.slice(0, 3).map((warning) => (
                <p className="app-meta" key={warning.code}>{warning.message}</p>
              ))}
            </Card>
          )}
        </div>
      )}

      <StickyActionBar>
        <Button disabled={!selected.size} variant="secondary" onClick={previewIt}>Preview</Button>
        <Button disabled={!selected.size} onClick={saveIt}>Create plan</Button>
      </StickyActionBar>
    </AppShell>
  )
}
