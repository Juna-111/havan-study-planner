'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Card, DateField, Select } from '@/components/ui'
import { apiFetch } from '@/lib/api'

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
  const [courseId, setCourseId] = useState('')
  const [examType, setExamType] = useState('MIDTERM')
  const [examDate, setExamDate] = useState('')
  const [importance, setImportance] = useState('3')
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const selectedKey = useMemo(() => Array.from(selectedCourseIds).sort((a, b) => a - b).join(','), [selectedCourseIds])

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
        const courseResponse = await apiFetch<Page<Course>>(
          '/courses?stream_id=' + streamId + '&include_freshman=true&page=1&page_size=100',
        )
        const selectedCourses = courseResponse.items.filter((course) => selectedCourseIds.has(course.id))
        const scopedCourses = await Promise.all(selectedCourses.map(async (course) => {
          const chapterResponse = await apiFetch<Page<{ id: number; name: string; status: string }>>(
            '/chapters?course_id=' + course.id + '&page=1&page_size=100',
          )
          const activeChapters = chapterResponse.items.filter((chapter) => chapter.status === 'ACTIVE')
          const chapters = await Promise.all(activeChapters.map(async (chapter) => {
            const topicResponse = await apiFetch<Page<Topic>>(
              '/topics?chapter_id=' + chapter.id + '&page=1&page_size=100',
            )
            return { ...chapter, topics: topicResponse.items.filter((topic) => topic.status === 'ACTIVE') }
          }))
          return { ...course, chapters }
        }))
        if (!cancelled) {
          setCourses(scopedCourses)
          setCourseId((current) => current && scopedCourses.some((course) => String(course.id) === current)
            ? current
            : String(scopedCourses[0]?.id ?? ''))
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

  useEffect(() => {
    const current = exams.find((exam) => exam.course_id === Number(courseId))
    if (!current) {
      setExamType('MIDTERM')
      setExamDate('')
      setImportance('3')
      setSelectedTopicIds([])
      return
    }
    setExamType(current.exam_type)
    setExamDate(current.exam_date)
    setImportance(String(current.importance))
    setSelectedTopicIds(current.selected_topic_ids)
  }, [courseId])

  function addOrUpdateExam() {
    if (!courseId || !examDate) return
    const next: Exam = {
      course_id: Number(courseId),
      exam_type: examType,
      exam_date: examDate,
      importance: Number(importance),
      selected_topic_ids: selectedTopicIds,
    }
    onExams([
      ...exams.filter((exam) => exam.course_id !== next.course_id),
      next,
    ])
    setExamDate('')
    setSelectedTopicIds([])
  }

  function removeExam(courseIdToRemove: number) {
    onExams(exams.filter((exam) => exam.course_id !== courseIdToRemove))
    if (courseIdToRemove === Number(courseId)) {
      setExamDate('')
      setSelectedTopicIds([])
    }
  }

  const activeCourse = courses.find((course) => course.id === Number(courseId))
  const selectedCount = selectedTopicIds.length

  return (
    <Card className="onboarding-exams-card">
      <div className="onboarding-section-heading">
        <span className="app-eyebrow">UPCOMING EXAMS</span>
        <h2>Tell Havan what you are preparing for.</h2>
        <p className="app-copy">Exams are optional. Add one if you already know the date, course, and scope. Your study plan still follows the topics you choose.</p>
      </div>

      {loadError && <p className="onboarding-inline-error" role="alert">{loadError}</p>}

      {!loading && courses.length === 0 ? (
        <div className="onboarding-empty-state">
          <strong>No exam can be added yet.</strong>
          <p>Select at least one course on the Academic step first.</p>
        </div>
      ) : (
        <div className="onboarding-exam-editor">
          <div className="onboarding-exam-grid">
            <Select label="Course" value={courseId} onChange={setCourseId} options={courses.map((course) => ({ value: String(course.id), label: course.code + ' · ' + course.name }))} disabled={loading} />
            <Select label="Exam type" value={examType} onChange={setExamType} options={TYPES} />
            <DateField label="Exam date" value={examDate} min={new Date().toISOString().slice(0, 10)} onChange={setExamDate} />
            <Select
              label="Importance"
              value={importance}
              onChange={setImportance}
              options={[1, 2, 3, 4, 5].map((value) => ({
                value: String(value),
                label: value === 5 ? '5 · Critical' : value === 1 ? '1 · Low' : value >= 4 ? value + ' · High' : value + ' · Normal',
              }))}
            />
          </div>

          {activeCourse && (
            <div className="onboarding-exam-scope">
              <div>
                <span className="app-eyebrow">EXAM SCOPE</span>
                <h3>What exactly are you preparing?</h3>
                <p className="app-copy">Leave every topic unchecked to use the full active course. Select topics only when the exam covers part of the course.</p>
              </div>
              <div className="onboarding-exam-scope-actions">
                <button type="button" className="onboarding-scope-clear" onClick={() => setSelectedTopicIds([])}>Use full course</button>
                <span>{selectedCount ? selectedCount + ' topics selected' : 'Full active course selected'}</span>
              </div>
              <div className="onboarding-exam-topic-groups">
                {activeCourse.chapters.map((chapter) => (
                  <div key={chapter.id} className="onboarding-exam-topic-group">
                    <strong>{chapter.name}</strong>
                    <div>
                      {chapter.topics.map((topic) => (
                        <label key={topic.id} className="onboarding-exam-topic">
                          <input
                            type="checkbox"
                            checked={selectedTopicIds.includes(topic.id)}
                            onChange={(event) => setSelectedTopicIds((current) =>
                              event.target.checked ? [...current, topic.id] : current.filter((id) => id !== topic.id)
                            )}
                          />
                          <span>{topic.name}</span>
                          <small>{topic.estimated_study_minutes} min</small>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="onboarding-exam-actions">
            <Button variant="accent" disabled={!courseId || !examDate} onClick={addOrUpdateExam}>
              {exams.some((exam) => exam.course_id === Number(courseId)) ? 'Update exam' : 'Add exam'}
            </Button>
            {exams.filter((exam) => exam.course_id === Number(courseId)).map((exam) => (
              <Button key={exam.course_id} variant="ghost" onClick={() => removeExam(exam.course_id)}>Remove exam</Button>
            ))}
          </div>
        </div>
      )}

      {exams.length > 0 && (
        <div className="onboarding-exam-list">
          <div className="onboarding-section-heading">
            <span className="app-eyebrow">YOUR EXAMS</span>
            <h3>{exams.length} exam{exams.length === 1 ? '' : 's'} added</h3>
          </div>
          {exams.map((exam) => {
            const course = courses.find((item) => item.id === exam.course_id)
            return (
              <div className="onboarding-exam-summary" key={exam.course_id}>
                <div>
                  <strong>{course?.code ?? 'Course'}</strong>
                  <span>{exam.exam_type} · {exam.exam_date} · importance {exam.importance}/5</span>
                  <small>{exam.selected_topic_ids.length ? exam.selected_topic_ids.length + ' selected topics' : 'Full active course scope'}</small>
                </div>
                <Button variant="ghost" onClick={() => removeExam(exam.course_id)}>Remove</Button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
