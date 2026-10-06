'use client'

import { useEffect, useState } from 'react'
import { Button, Card, DateField, Select } from '@/components/ui'
import { apiFetch, ApiError } from '@/lib/api'

type Course = { id: number; course_code: string; course_name: string }
type Exam = { id: number; course_id: number; exam_type: string; exam_date: string; importance: number }

const TYPES = [
  { value: 'MIDTERM', label: 'Midterm' },
  { value: 'FINAL', label: 'Final exam' },
  { value: 'QUIZ', label: 'Quiz' },
  { value: 'OTHER', label: 'Other' },
]

export default function ExamManager() {
  const [profileId, setProfileId] = useState<number | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [courseId, setCourseId] = useState('')
  const [examType, setExamType] = useState('MIDTERM')
  const [examDate, setExamDate] = useState('')
  const [importance, setImportance] = useState('3')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [profile, courseRows, examRows] = await Promise.all([
        apiFetch<{ id: number }>('/students/me/profile'),
        apiFetch<Course[]>('/students/me/courses'),
        apiFetch<Exam[]>('/students/me/exams'),
      ])
      setProfileId(profile.id)
      setCourses(courseRows)
      setExams(examRows)
      setCourseId((current) => current || String(courseRows[0]?.id ?? ''))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load your exams.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function addExam() {
    if (!courseId || !examDate || saving) return
    setSaving(true)
    setError('')
    try {
      const created = await apiFetch<Exam>('/students/me/exams', {
        method: 'POST',
        body: JSON.stringify({
          course_id: Number(courseId),
          exam_type: examType,
          exam_date: examDate,
          importance: Number(importance),
        }),
      })
      setExams((current) => [...current, created].sort((a, b) => a.exam_date.localeCompare(b.exam_date)))
      setExamDate('')
    } catch (value) {
      setError(value instanceof ApiError ? value.message : 'Could not save the exam.')
    } finally {
      setSaving(false)
    }
  }

  async function removeExam(id: number) {
    try {
      if (!profileId) return
      await apiFetch<void>(`/students/profiles/${profileId}/exams/${id}`, { method: 'DELETE' })
      setExams((current) => current.filter((exam) => exam.id !== id))
    } catch {
      setError('Could not remove that exam.')
    }
  }

  const courseName = new Map(courses.map((course) => [course.id, course.course_code + ' · ' + course.course_name]))

  return (
    <Card padding="lg" className="settings-card">
      <h2>Exams</h2>
      <p className="app-copy">Add dates you want Havan to consider when organising your study time.</p>
      {error && <p className="app-copy" role="alert">{error}</p>}
      {loading ? (
        <p className="app-meta">Loading exams…</p>
      ) : courses.length === 0 ? (
        <p className="app-copy">No mapped courses are available yet, so there is nothing to attach an exam to.</p>
      ) : (
        <>
          <div className="app-form">
            <Select label="Course" value={courseId} onChange={setCourseId} options={courses.map((course) => ({ value: String(course.id), label: course.course_code + ' · ' + course.course_name }))} />
            <Select label="Exam type" value={examType} onChange={setExamType} options={TYPES} />
            <DateField label="Exam date" value={examDate} onChange={setExamDate} />
            <Select
              label="Importance"
              value={importance}
              onChange={setImportance}
              options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: value === 5 ? '5 · Very important' : `${value} · ${value === 1 ? 'Low' : value === 3 ? 'Normal' : 'High'}` }))}
            />
            <Button disabled={!courseId || !examDate || saving} loading={saving} onClick={addExam}>Add exam</Button>
          </div>

          <div className="stack">
            {exams.length === 0 ? (
              <p className="app-meta">No exam dates added yet.</p>
            ) : exams.map((exam) => (
              <div className="topic-row" key={exam.id}>
                <div>
                  <strong>{courseName.get(exam.course_id) ?? 'Course'}</strong>
                  <p className="app-meta">{exam.exam_type} · {exam.exam_date} · importance {exam.importance}/5</p>
                </div>
                <Button variant="ghost" onClick={() => void removeExam(exam.id)}>Remove</Button>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
