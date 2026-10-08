'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Card, DateField, Select } from '@/components/ui'
import { apiFetch } from '@/lib/api'
import { todayLocalISO } from '@/lib/dates'

type Course = { id: number; code: string; name: string }
type Topic = { id: number; name: string; estimated_study_minutes: number; status: string }
type Chapter = { id: number; name: string; status: string; topics: Topic[] }
type CourseScope = Course & { chapters: Chapter[] }
type Page<T> = { items: T[]; page: number; page_size: number; total: number; pages: number }
type Exam = { course_id: number; exam_type: string; exam_date: string; importance: number; selected_topic_ids: number[] }

const TYPES = [
  { value: 'MIDTERM', label: 'Midterm' },
  { value: 'FINAL', label: 'Final exam' },
  { value: 'QUIZ', label: 'Quiz' },
  { value: 'OTHER', label: 'Other' },
]

function emptyExam(courseId = 0): Exam {
  return { course_id: courseId, exam_type: 'MIDTERM', exam_date: '', importance: 3, selected_topic_ids: [] }
}

export default function StepExams({
  streamId,
  selectedCourseIds,
  exams,
  onExams,
}: {
  streamId: string
  selectedCourseIds: ReadonlySet<number>
  exams: Exam[]
  onExams: (exams: Exam[]) => void
}) {
  const [courses, setCourses] = useState<CourseScope[]>([])
  const [draft, setDraft] = useState<Exam>(emptyExam())
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const selectedKey = useMemo(
    () => Array.from(selectedCourseIds).sort((a, b) => a - b).join(','),
    [selectedCourseIds],
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!streamId || !selectedKey) {
        setCourses([])
        return
      }
      setLoading(true)
      setLoadError('')
      try {
        const response = await apiFetch<Page<Course>>(
          '/courses?stream_id=' + streamId + '&include_freshman=true&page=1&page_size=100',
        )
        const selectedCourses = response.items.filter((course) => selectedCourseIds.has(course.id))
        const scopedCourses = await Promise.all(selectedCourses.map(async (course) => {
          const chapterResponse = await apiFetch<Page<{ id: number; name: string; status: string }>>(
            '/chapters?course_id=' + course.id + '&page=1&page_size=100',
          )
          const activeChapters = chapterResponse.items.filter((chapter) => chapter.status.toUpperCase() === 'ACTIVE')
          const chapters = await Promise.all(activeChapters.map(async (chapter) => {
            const topicResponse = await apiFetch<Page<Topic>>(
              '/topics?chapter_id=' + chapter.id + '&page=1&page_size=100',
            )
            return {
              ...chapter,
              topics: topicResponse.items.filter((topic) => topic.status.toUpperCase() === 'ACTIVE'),
            }
          }))
          return { ...course, chapters }
        }))
        if (!cancelled) {
          setCourses(scopedCourses)
          setDraft((current) => {
            const valid = current.course_id && scopedCourses.some((course) => course.id === current.course_id)
            return valid ? current : emptyExam(scopedCourses[0]?.id ?? 0)
          })
        }
      } catch (value) {
        if (!cancelled) setLoadError(value instanceof Error ? value.message : 'Could not load exam topics.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [streamId, selectedKey])

  const activeCourse = courses.find((course) => course.id === draft.course_id)

  function updateDraft(patch: Partial<Exam>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function changeCourse(value: string) {
    const courseId = Number(value)
    setDraft((current) => ({ ...current, course_id: courseId, selected_topic_ids: [] }))
  }

  function toggleTopic(topicId: number, checked: boolean) {
    setDraft((current) => ({
      ...current,
      selected_topic_ids: checked
        ? [...new Set([...current.selected_topic_ids, topicId])]
        : current.selected_topic_ids.filter((id) => id !== topicId),
    }))
  }

  function addExam() {
    if (!draft.course_id || !draft.exam_date || !draft.exam_type.trim()) return
    onExams([...exams, { ...draft, exam_type: draft.exam_type.trim().toUpperCase() }])
    setDraft(emptyExam(draft.course_id))
  }

  function removeExam(index: number) {
    onExams(exams.filter((_, current) => current !== index))
  }

  return (
    <Card className="onboarding-exams-card">
      <div className="onboarding-section-heading">
        <span className="app-eyebrow">OPTIONAL EXAM SETUP</span>
        <h2>Tell Havan what you are preparing for.</h2>
        <p className="app-copy">Exams are optional. Add every known exam separately. For a partial exam, select only the topics it covers. Leave all topics unchecked when it covers the full active course.</p>
      </div>

      {loadError && <p className="onboarding-inline-error" role="alert">{loadError}</p>}

      {loading ? (
        <div className="onboarding-loading-state" role="status">
          <strong>Loading your selected courses…</strong>
          <span>Havan is preparing the available exam scope.</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="onboarding-empty-state">
          <strong>No exam can be added yet.</strong>
          <p>Select at least one course on the Academic step first.</p>
        </div>
      ) : (
        <>
          <div className="onboarding-exam-editor">
            <div className="onboarding-exam-grid">
              <Select label="Course" value={String(draft.course_id)} onChange={changeCourse} options={courses.map((course) => ({ value: String(course.id), label: course.name }))} />
              <Select label="Exam type" value={draft.exam_type} onChange={(value) => updateDraft({ exam_type: value })} options={TYPES} />
              <DateField label="Exam date" value={draft.exam_date} min={todayLocalISO()} onChange={(value) => updateDraft({ exam_date: value })} />
              <Select
                label="Importance"
                value={String(draft.importance)}
                onChange={(value) => updateDraft({ importance: Number(value) })}
                options={[1, 2, 3, 4, 5].map((value) => ({
                  value: String(value),
                  label: value === 5 ? '5 · Critical' : value === 1 ? '1 · Low' : value >= 4 ? value + ' · High' : value + ' · Normal',
                }))}
              />
            </div>

            {activeCourse && (
              <div className="onboarding-exam-scope">
                <div className="onboarding-exam-scope-heading">
                  <div>
                    <span className="app-eyebrow">EXAM SCOPE</span>
                    <h3>{activeCourse.name}</h3>
                    <p className="app-copy">Choose specific topics only when this exam covers part of the course.</p>
                  </div>
                  <Button variant="ghost" onClick={() => updateDraft({ selected_topic_ids: [] })}>Use full course</Button>
                </div>
                <div className="onboarding-exam-topic-groups">
                  {activeCourse.chapters.map((chapter) => (
                    <div key={chapter.id} className="onboarding-exam-topic-group">
                      <strong>{chapter.name}</strong>
                      <div>
                        {chapter.topics.map((topic) => (
                          <label key={topic.id} className="onboarding-exam-topic">
                            <input type="checkbox" checked={draft.selected_topic_ids.includes(topic.id)} onChange={(event) => toggleTopic(topic.id, event.target.checked)} />
                            <span>{topic.name}</span>
                            <small>{topic.estimated_study_minutes} min</small>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="onboarding-exam-scope-count">
                  {draft.selected_topic_ids.length ? draft.selected_topic_ids.length + ' specific topics selected' : 'Full active course scope'}
                </div>
              </div>
            )}

            <div className="onboarding-exam-actions">
              <Button variant="accent" disabled={!draft.course_id || !draft.exam_date} onClick={addExam}>Add exam</Button>
            </div>
          </div>

          <div className="onboarding-exam-list">
            <div className="onboarding-section-heading">
              <span className="app-eyebrow">YOUR EXAMS</span>
              <h3>{exams.length ? exams.length + ' exam' + (exams.length === 1 ? '' : 's') + ' added' : 'No exams added yet'}</h3>
            </div>
            {exams.map((exam, index) => {
              const course = courses.find((item) => item.id === exam.course_id)
              return (
                <div className="onboarding-exam-summary" key={exam.course_id + '-' + exam.exam_type + '-' + exam.exam_date + '-' + index}>
                  <div>
                    <strong>{course?.name ?? 'Course'}</strong>
                    <span>{exam.exam_type} · {exam.exam_date} · importance {exam.importance}/5</span>
                    <small>{exam.selected_topic_ids.length ? exam.selected_topic_ids.length + ' selected topics' : 'Full active course scope'}</small>
                  </div>
                  <Button variant="ghost" onClick={() => removeExam(index)}>Remove</Button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
