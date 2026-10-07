'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell, PageHeader, StickyActionBar } from '@/components/layout'
import { Button, Card, EmptyState, ErrorState, NumberStepper, Segmented, TreeSelect } from '@/components/ui'
import { apiFetch } from '@/lib/api'
import { createHavanPlan, previewHavanPlan, type HavanPlan, type HavanPlanMode } from '@/lib/havanPlan'

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
  initialMode?: HavanPlanMode
}

const modeCopy: Record<HavanPlanMode, { title: string; description: string; horizon: string }> = {
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
  const [mode, setMode] = useState<HavanPlanMode>(initialMode ?? 'week')
  const [hours, setHours] = useState(2)
  const [studyDays, setStudyDays] = useState<string[]>([])
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<HavanPlan | null>(null)
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null)
  const [previewPulse, setPreviewPulse] = useState(false)

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode)
      return
    }

    const requestedMode = new URLSearchParams(window.location.search).get('mode')
    if (requestedMode === 'today' || requestedMode === 'week' || requestedMode === 'month') {
      setMode(requestedMode as HavanPlanMode)
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
      setStudyDays(student.study_days ?? [])
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load your study data.')
    }
  }, [])

  useEffect(() => {
    void loadStudyData()
  }, [loadStudyData])

  const horizon = mode === 'today' ? 1 : mode === 'week' ? 7 : 28
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

  const studyDayCount = mode === 'today' ? 1 : studyDays.length
  const dailyMinutes = hours * 60

  const input = useMemo(() => {
    const weekdayMap: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
    const selectedDays = mode === 'today'
      ? [((new Date().getDay() + 6) % 7)]
      : studyDays.map((day) => weekdayMap[day]).filter((day) => day !== undefined)
    return {
      mode,
      horizon_days: horizon,
      topic_ids: [...selected],
      study_days: selectedDays,
      hours_per_day: Object.fromEntries(selectedDays.map((weekday) => [weekday, hours])),
    }
  }, [mode, horizon, selected, studyDays, hours])

  async function previewIt() {
    if (busy || !selected.size) return
    try {
      setError('')
      setBusy('preview')
      const nextPreview = await previewHavanPlan(input)
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
      const saved = await createHavanPlan(input)
      if (!saved.id) throw new Error('Havan did not confirm that your plan was saved. Please try again.')
      router.push('/student/havan/plan')
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
        {mode !== 'today' && (
          <div className="havan-builder-days">
            <div className="havan-builder-days-heading">
              <strong>Available study days</strong>
              <span>{studyDayCount} selected</span>
            </div>
            <div className="havan-builder-day-grid" role="group" aria-label="Available study days">
              {(['mon','tue','wed','thu','fri','sat','sun'] as const).map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={studyDays.includes(day)}
                  className="havan-builder-day"
                  onClick={() => {
                    setStudyDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])
                    setPreview(null)
                  }}
                >
                  {day.slice(0, 1).toUpperCase() + day.slice(1, 3)}
                </button>
              ))}
            </div>
            {studyDayCount === 0 && <p className="app-meta">Choose at least one day for a week or month plan.</p>}
          </div>
        )}
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
            <span>{selectedMinutes} min of estimated study content</span>
          </div>
          <div>
            <strong>{dailyMinutes} min per study day</strong>
            <span>{studyDayCount * dailyMinutes} min available in this planning window</span>
          </div>
          <p>Havan does not discover extra topics. It only divides the time you give it across the topics you selected.</p>
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
                setPreview(null)
              }}
            />
          </Card>

          {selectedTopics.length > 0 && (
            <Card padding="lg" className="havan-topic-time-card havan-motion-enter">
              <div>
                <span className="app-eyebrow">STEP 2 · AUTOMATIC ALLOCATION</span>
                <h2>Havan will divide your time</h2>
                <p className="app-meta">Topic estimated study time determines each selected topic's share. You do not need to enter minutes manually. The preview uses the same Havan engine that creates the saved plan.</p>
              </div>
              <div className="plan-capacity">
                <div><strong>{selectedMinutes} min estimated content</strong><span>Across {selectedTopics.length} selected topics</span></div>
                <div><strong>{hours * 60} min per study day</strong><span>{studyDayCount} selected study days in this plan</span></div>
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
                    {preview.total_minutes} minutes allocated across {preview.tasks.length} study tasks. Every task comes from a topic you selected.
                  </p>
                  {preview.tasks.length > 0 && (
                    <div className="plan-review-list">
                      {preview.tasks.map((task, index) => (
                        <div className="plan-review-row havan-allocation-row" style={{ '--motion-delay': `${index * 55}ms` } as React.CSSProperties} key={`${task.topic_id}-${task.planned_date}-${index}`}>
                          <div>
                            <strong>{task.topic_name}</strong>
                            <span>{task.course_code} · {task.chapter_name}</span>
                          </div>
                          <div>
                            <strong>{task.minutes} min</strong>
                            <span>{task.planned_date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}                </>
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
            <Button disabled={!selected.size || busy !== null || (mode !== 'today' && studyDayCount === 0)} variant="secondary" onClick={previewIt}>
              {busy === 'preview' ? 'Building preview...' : 'Preview allocation'}
            </Button>
            <Button variant="accent" disabled={!selected.size || busy !== null || (mode !== 'today' && studyDayCount === 0)} onClick={saveIt}>
              {busy === 'save' ? 'Creating your plan...' : 'Create my Havan plan'}
            </Button>
          </div>
        </div>
      </StickyActionBar>
    </AppShell>
  )
}
