'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell, PageHeader, StickyActionBar } from '@/components/layout'
import { Button, Card, EmptyState, ErrorState, NumberStepper, Segmented, TreeSelect } from '@/components/ui'
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

export function PlanBuilder() {
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
    const requestedMode = new URLSearchParams(window.location.search).get('mode')
    if (requestedMode === 'today' || requestedMode === 'week' || requestedMode === 'month') {
      setMode(requestedMode)
    }
  }, [])

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

  const selectedMinutes = useMemo(
    () => courses
      .flatMap((course) => course.chapters.flatMap((chapter) => chapter.topics))
      .filter((topic) => selected.has(topic.id))
      .reduce((total, topic) => total + topic.estimated_study_minutes, 0),
    [courses, selected],
  )

  const studyDayCount = profile?.study_days?.length ?? 0
  const dailyMinutes = hours * 60


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

      {selected.size > 0 && (
        <Card padding="md" className="plan-capacity">
          <div>
            <strong>{selected.size} {selected.size === 1 ? 'topic' : 'topics'} selected</strong>
            <span>{selectedMinutes} min of study content</span>
          </div>
          <div>
            <strong>{dailyMinutes} min on each study day</strong>
            <span>{studyDayCount} {studyDayCount === 1 ? 'study day' : 'study days'} per week</span>
          </div>
          <p>Havan will spread the selected topics across your available study days. Preview shows exactly what fits.</p>
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={() => setError('')} />}

      {!courses.length && !error ? (
        <EmptyState title="No topics available" hint="Your selected courses do not have active topic data yet." />
      ) : (
        <div className="app-section">
          <Card padding="lg" className="plan-course">
            <div>
              <h2>Choose your topics</h2>
              <p className="app-meta">
                Open a chapter, then select the specific topics you want Havan to schedule.
              </p>
            </div>
            <TreeSelect
              courses={courses.map((course) => ({
                id: String(course.id),
                name: `${course.code} · ${course.name}`,
                chapters: course.chapters.map((chapter) => ({
                  id: String(chapter.id),
                  name: chapter.name,
                  topics: chapter.topics.map((topic) => ({
                    id: String(topic.id),
                    name: topic.name,
                    minutes: topic.estimated_study_minutes,
                  })),
                })),
              }))}
              selected={new Set([...selected].map(String))}
              onChange={(next) => setSelected(new Set([...next].map(Number)))}
            />
            {selected.size > 0 && (
              <div className="app-section">
                <p className="app-meta">Already know a selected topic? Mark it known so Havan can account for it.</p>
                <div className="topic-list">
                  {[...selected].map((topicId) => {
                    const topic = courses.flatMap((course) => course.chapters.flatMap((chapter) => chapter.topics))
                      .find((item) => item.id === topicId)
                    if (!topic) return null
                    return (
                      <label className="plan-topic-row" key={topic.id}>
                        <span>{topic.name}</span>
                        <input
                          type="checkbox"
                          checked={known.has(topic.id)}
                          onChange={(event) => setKnown((old) => {
                            const next = new Set(old)
                            event.target.checked ? next.add(topic.id) : next.delete(topic.id)
                            return next
                          })}
                        />
                        <span className="app-meta">Known</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>

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
