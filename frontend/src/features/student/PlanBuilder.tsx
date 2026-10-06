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

type Chapter = { id: number; name: string; important_points?: string | null; topics: Topic[] }
type Course = { id: number; code: string; name: string; chapters: Chapter[] }
type Profile = { study_hours_per_day: number; study_days: string[] }

type PlanBuilderProps = {
  initialMode?: PlanMode
}

const modeCopy: Record<PlanMode, { title: string; description: string; horizon: string }> = {
  today: {
    title: 'Havan Today',
    description: 'Choose exactly what you want to study today. Havan allocates your available time across those topics.',
    horizon: '1 day',
  },
  week: {
    title: 'Havan Week',
    description: 'Choose the courses, chapters, and topics for your week. Havan spreads them across your available study days.',
    horizon: '7 days',
  },
  month: {
    title: 'Havan Month',
    description: 'Choose what you want to cover this month. Havan organizes your selected topics across the available study days.',
    horizon: '28 days',
  },
}

function criticalPoints(value?: string | null) {
  if (!value?.trim()) return []
  return value
    .split(/\r?\n|•/)
    .map((item) => item.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

export function PlanBuilder({ initialMode }: PlanBuilderProps) {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [mode, setMode] = useState<PlanMode>(initialMode ?? 'week')
  const [hours, setHours] = useState(2)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Plan | null>(null)
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null)

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode)
      return
    }

    const requestedMode = new URLSearchParams(window.location.search).get('mode')
    if (requestedMode === 'today' || requestedMode === 'week' || requestedMode === 'month') {
      setMode(requestedMode)
    }
  }, [initialMode])

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

  const selectedTopics = useMemo(
    () => courses
      .flatMap((course) => course.chapters.flatMap((chapter) => chapter.topics))
      .filter((topic) => selected.has(topic.id)),
    [courses, selected],
  )

  const selectedMinutes = useMemo(
    () => selectedTopics.reduce((total, topic) => total + topic.estimated_study_minutes, 0),
    [selectedTopics],
  )

  const studyDayCount = profile?.study_days?.length ?? 0
  const dailyMinutes = hours * 60

  const input = useMemo(() => ({
    mode,
    horizon_days: horizon,
    topic_ids: [...selected],
    known_topic_ids: [],
    study_days: profile?.study_days ?? [],
    minutes_by_weekday: minutesByDay,
    hours_per_day: hours,
  }), [mode, horizon, selected, profile?.study_days, minutesByDay, hours])

  async function previewIt() {
    if (busy || !selected.size) return
    try {
      setError('')
      setBusy('preview')
      setPreview(await previewPlan(input))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not preview your plan.')
    } finally {
      setBusy(null)
    }
  }

  async function saveIt() {
    if (busy || !selected.size) return
    try {
      setError('')
      setBusy('save')
      await savePlan(input)
      router.push('/plan')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save your plan.')
    } finally {
      setBusy(null)
    }
  }

  const copy = modeCopy[mode]

  return (
    <AppShell>
      <PageHeader title={copy.title} backHref="/student/havan" description={copy.description} />

      <Card padding="lg" className="app-section havan-plan-controls">
        <div className="havan-plan-mode">
          <div>
            <span className="app-eyebrow">PLAN HORIZON</span>
            <strong>{copy.horizon}</strong>
          </div>
          <span className="havan-plan-control-note">Your selections stay under your control.</span>
        </div>
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
          <p>Havan will allocate the selected topics across your available study days. Preview shows exactly what fits.</p>
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={() => setError('')} />}

      {!courses.length && !error ? (
        <EmptyState title="No topics available" hint="Your selected courses do not have active topic data yet." />
      ) : (
        <div className="app-section">
          <Card padding="lg" className="plan-course">
            <div>
              <span className="app-eyebrow">STEP 1</span>
              <h2>Choose your topics</h2>
              <p className="app-meta">Open a course, then a chapter, and select only the specific topics you want Havan to schedule.</p>
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
              onChange={(next) => {
                setSelected(new Set([...next].map(Number)))
                setPreview(null)
              }}
            />
          </Card>

          {selectedTopics.length > 0 && (
            <Card padding="lg" className="havan-critical-points">
              <div>
                <span className="app-eyebrow">STEP 2 · HAVAN ACADEMY</span>
                <h2>Chapter guidance</h2>
                <p className="app-meta">Chapter-level critical points entered by the Havan Academy admin for the chapters containing your selected topics.</p>
              </div>
              <div className="havan-chapter-guidance">
                {Array.from(new Map(
                  selectedTopics.map((topic) => {
                    const chapter = courses.flatMap((course) => course.chapters).find((item) => item.topics.some((entry) => entry.id === topic.id))
                    return [chapter?.id ?? topic.id, chapter]
                  }).filter((entry): entry is [number, Chapter] => Boolean(entry[1]))
                ).values()).map((chapter) => {
                  const points = criticalPoints(chapter.important_points)
                  return (
                    <article className="havan-chapter-guidance-item" key={chapter.id}>
                      <strong>{chapter.name}</strong>
                      {points.length > 0 ? (
                        <ul>{points.map((point, index) => <li key={index}>{point}</li>)}</ul>
                      ) : (
                        <p className="app-meta">No chapter critical points have been added yet.</p>
                      )}
                    </article>
                  )
                })}
              </div>
              <div className="havan-resource-note">
                <strong>Havan Academy resources</strong>
                <p>Course videos, notes, and Freshman Exam Questions will appear here when those resources are published for the selected content.</p>
              </div>
            </Card>
          )}

          {selectedTopics.length > 0 && (
              <div>
                <span className="app-eyebrow">STEP 2 · HAVAN ACADEMY</span>
                <h2>Important points for your selected topics</h2>
                <p className="app-meta">These are the critical points entered by the Havan Academy admin for the selected topics.</p>
              </div>
              <div className="havan-topic-insights">
                {selectedTopics.map((topic) => {
                  const points = criticalPoints(topic.important_points)
                  return (
                    <article className="havan-topic-insight" key={topic.id}>
                      <div className="havan-topic-insight-heading">
                        <strong>{topic.name}</strong>
                        <span>{topic.estimated_study_minutes} min</span>
                      </div>
                      {points.length > 0 ? (
                        <ul>
                          {points.map((point, index) => <li key={`${topic.id}-${index}`}>{point}</li>)}
                        </ul>
                      ) : (
                        <p className="app-meta">No critical points have been added for this topic yet.</p>
                      )}
                    </article>
                  )
                })}
              </div>
            </Card>
          )}

          {selectedTopics.length > 0 && (
            <Card padding="lg" className="plan-review">
              <span className="app-eyebrow">STEP 3</span>
              <h2>Review your allocation</h2>
              {!preview ? (
                <p className="app-copy">Preview the plan to see how your selected topics fit into {copy.horizon}.</p>
              ) : (
                <>
                  <p className="app-copy">
                    {preview.total_minutes} minutes placed. {preview.unplaced.length} topics could not fit.
                  </p>
                  {preview.tasks.length > 0 && (
                    <div className="plan-review-list">
                      {preview.tasks.map((task) => (
                        <div className="plan-review-row" key={task.id}>
                          <div>
                            <strong>{task.topic_name}</strong>
                            <span>{task.course_code} · {task.course_name}</span>
                          </div>
                          <div>
                            <strong>{task.minutes} min</strong>
                            <span>{task.planned_date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {preview.unplaced.length > 0 && (
                    <div className="plan-review-unplaced">
                      <strong>Could not fit</strong>
                      {preview.unplaced.map((item) => (
                        <p key={item.topic_id}>{item.topic_name} · {item.minutes} min</p>
                      ))}
                    </div>
                  )}
                  {preview.warnings.slice(0, 3).map((warning) => (
                    <p className="app-meta" key={warning.code}>{warning.message}</p>
                  ))}
                </>
              )}
            </Card>
          )}
        </div>
      )}

      <StickyActionBar>
        <Button disabled={!selected.size || busy !== null} variant="secondary" onClick={previewIt}>
          {busy === 'preview' ? 'Previewing...' : 'Preview'}
        </Button>
        <Button variant="accent" disabled={!selected.size || busy !== null} onClick={saveIt}>
          {busy === 'save' ? 'Creating...' : 'Create plan'}
        </Button>
      </StickyActionBar>
    </AppShell>
  )
}
