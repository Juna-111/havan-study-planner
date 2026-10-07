'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [topicMinutes, setTopicMinutes] = useState<Record<number, number>>({})
  const [mode, setMode] = useState<PlanMode>(initialMode ?? 'week')
  const [hours, setHours] = useState(2)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Plan | null>(null)
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null)
  const [previewPulse, setPreviewPulse] = useState(false)

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

  const loadStudyData = useCallback(async () => {
    try {
      setError('')
      const [catalog, student] = await Promise.all([
        apiFetch<Course[]>('/students/me/catalog'),
        apiFetch<Profile>('/students/me/profile'),
      ])
      setCourses(catalog)
      setProfile(student)
      setHours(student.study_hours_per_day)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load your study data.')
    }
  }, [])

  useEffect(() => {
    void loadStudyData()
  }, [loadStudyData])

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
    topic_minutes: topicMinutes,
  }), [mode, horizon, selected, profile?.study_days, minutesByDay, hours, topicMinutes])

  async function previewIt() {
    if (busy || !selected.size) return
    try {
      setError('')
      setBusy('preview')
      const nextPreview = await previewPlan(input)
      setPreview(nextPreview)
      setPreviewPulse(true)
      window.setTimeout(() => setPreviewPulse(false), 700)
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
      const saved = await savePlan(input)
      if (!saved.saved || !saved.id) {
        throw new Error('Havan did not confirm that your plan was saved. Please try again.')
      }
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

      <Card padding="lg" className="app-section havan-plan-controls havan-time-step">
        <div className="havan-plan-mode">
          <div>
            <span className="app-eyebrow">PLAN HORIZON</span>
            <strong>{copy.horizon}</strong>
          </div>
          <span className="havan-plan-control-note">{mode === 'today' ? 'Tell Havan exactly how much time you can study today.' : 'Set the time you can study on each available study day.'}</span>
        </div>
        <Segmented
          options={['today', 'week', 'month'] as const}
          value={mode}
          onChange={(next) => {
            setMode(next)
            setPreview(null)
          }}
        />
        <NumberStepper
          label={mode === 'today' ? 'Study time today (hours)' : 'Study time per study day (hours)'}
          value={hours}
          min={1}
          max={12}
          onChange={(next) => {
            setHours(next)
            setPreview(null)
          }}
        />
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

      {error && <ErrorState message={error} onRetry={() => void loadStudyData()} />}

      {!courses.length && !error ? (
        <EmptyState title="No topics available" hint="Your selected courses do not have active topic data yet." />
      ) : (
        <div className="app-section">
          <Card padding="lg" className="plan-course havan-motion-enter" style={{ '--motion-delay': '40ms' } as React.CSSProperties}>
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
                const ids = new Set([...next].map(Number))
                setSelected(ids)
                setTopicMinutes((current) => {
                  const nextMinutes = { ...current }
                  for (const id of Object.keys(nextMinutes).map(Number)) if (!ids.has(id)) delete nextMinutes[id]
                  for (const course of courses) for (const chapter of course.chapters) for (const topic of chapter.topics) {
                    if (ids.has(topic.id) && !nextMinutes[topic.id]) {
                      nextMinutes[topic.id] = Math.max(20, Math.min(35, 20 + (topic.difficulty - 1) * 3 + (topic.estimated_study_minutes >= 120 ? 3 : 0)))
                    }
                  }
                  return nextMinutes
                })
                setPreview(null)
              }}
            />
          </Card>

          {selectedTopics.length > 0 && (
            <Card padding="lg" className="havan-topic-time-card havan-motion-enter">
              <div><span className="app-eyebrow">STEP 2 · SESSION TIME</span><h2>Set time for each topic</h2><p className="app-meta">First-time topics start with a focused 20–35 minute session. Adjust any topic to fit your study pace.</p></div>
              <div className="havan-topic-time-list">
                {selectedTopics.map((topic) => <div className="havan-topic-time-row" key={topic.id}><div><strong>{topic.name}</strong><span>{topic.estimated_study_minutes} min total content · difficulty {topic.difficulty}/5</span></div><NumberStepper label="Session minutes" value={topicMinutes[topic.id] ?? 25} min={5} max={120} step={5} onChange={(value) => { setTopicMinutes((current) => ({ ...current, [topic.id]: value })); setPreview(null) }} /></div>)}
              </div>
            </Card>
          )}

          {selectedTopics.length > 0 && (
            <Card padding="lg" className="havan-critical-points havan-motion-enter" style={{ '--motion-delay': '110ms' } as React.CSSProperties}>
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
            <Card padding="lg" className="havan-critical-points havan-motion-enter" style={{ '--motion-delay': '170ms' } as React.CSSProperties}>
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
            <Card padding="lg" className={`plan-review havan-motion-enter ${previewPulse ? 'havan-plan-ready' : ''}`} style={{ '--motion-delay': '230ms' } as React.CSSProperties}>
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
                      {preview.tasks.map((task, index) => (
                        <div className="plan-review-row havan-allocation-row" style={{ '--motion-delay': `${index * 55}ms` } as React.CSSProperties} key={task.id}>
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
                    <div className="plan-review-unplaced havan-motion-enter">
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
        <div className="havan-generate-bar">
          <div className="havan-generate-summary">
            <strong>{selected.size ? `${selected.size} ${selected.size === 1 ? 'topic' : 'topics'} · ${hours}h ${mode === 'today' ? 'today' : 'per study day'}` : 'Choose topics and study time'}</strong>
            <span>{selected.size ? 'Havan is ready to organize your choices.' : 'Your plan is created only after you choose both.'}</span>
          </div>
          <div className="havan-generate-actions">
            <Button disabled={!selected.size || busy !== null} variant="secondary" onClick={previewIt}>
              {busy === 'preview' ? 'Building preview...' : 'Preview allocation'}
            </Button>
            <Button variant="accent" disabled={!selected.size || busy !== null} onClick={saveIt}>
              {busy === 'save' ? 'Creating your plan...' : 'Create my Havan plan'}
            </Button>
          </div>
        </div>
      </StickyActionBar>
    </AppShell>
  )
}
