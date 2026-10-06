'use client'

import { useEffect, useState } from 'react'
import { Card, Checkbox, Select } from '@/components/ui'
import { apiFetch } from '@/lib/api'
import AcademicCatalogRequest from './AcademicCatalogRequest'

type Opt = { id: number; name: string; status?: string }
type Course = { id: number; code: string; name: string }
type Page<T> = { items: T[]; page: number; page_size: number; total: number; pages: number }

type Props = {
  name: string
  university: string
  curriculum: string
  stream: string
  selected: Set<number>
  starts: Record<number, { chapter?: number; topic?: number }>
  onName: (value: string) => void
  onUniversity: (value: string) => void
  onCurriculum: (value: string) => void
  onStream: (value: string) => void
  onToggleCourse: (id: number, checked: boolean) => void
  onStart: (courseId: number, value: { chapter?: number; topic?: number }) => void
}

export default function StepAcademic(props: Props) {
  const [unis, setUnis] = useState<Opt[]>([])
  const [curricula, setCurricula] = useState<Opt[]>([])
  const [streams, setStreams] = useState<Opt[]>([])
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    apiFetch<Page<Opt>>('/universities?page=1&page_size=100').then((response) => setUnis(response.items))
  }, [])

  useEffect(() => {
    setCurricula([])
    if (!props.university) return
    apiFetch<Page<Opt>>(`/curriculums?university_id=${props.university}&page=1&page_size=100`)
      .then((response) => setCurricula(response.items))
  }, [props.university])

  useEffect(() => {
    setStreams([])
    if (!props.curriculum) return
    apiFetch<Page<Opt>>(`/streams?curriculum_id=${props.curriculum}&page=1&page_size=100`)
      .then((response) => setStreams(response.items))
  }, [props.curriculum])

  useEffect(() => {
    setCourses([])
    if (!props.stream) return
    apiFetch<Page<Course>>(`/courses?stream_id=${props.stream}&include_freshman=true&page=1&page_size=100`)
      .then((response) => setCourses(response.items))
  }, [props.stream])

  return (
    <div className="stack">
      <Card>
        <div className="stack">
          <label className="onboarding-field">
            Your name
            <input value={props.name} onChange={(e) => props.onName(e.target.value)} />
          </label>
          <Select label="University" value={props.university} onChange={props.onUniversity} options={unis.map((x) => ({ value: String(x.id), label: x.name }))} />
          <Select label="Curriculum" value={props.curriculum} onChange={props.onCurriculum} options={curricula.map((x) => ({ value: String(x.id), label: x.name }))} />
          <div>
            <Select label="Stream (required)" value={props.stream} onChange={props.onStream} options={streams.filter((x) => x.status === 'ACTIVE').map((x) => ({ value: String(x.id), label: x.name }))} />
            {props.curriculum && !streams.some((x) => x.status === 'ACTIVE') && <p className="app-copy">No active stream has been added for this curriculum yet. Ask the Havan admin to add it.</p>}
          </div>
        </div>
      </Card>

      <AcademicCatalogRequest universityId={props.university} />

      <Card>
        <h2>Choose your courses</h2>
        <div className="stack">
          {courses.map((course) => (
            <CourseChoice
              key={course.id}
              course={course}
              checked={props.selected.has(course.id)}
              start={props.starts[course.id]}
              onToggle={props.onToggleCourse}
              onStart={props.onStart}
            />
          ))}
        </div>
      </Card>
    </div>
  )
}

function CourseChoice({
  course,
  checked,
  start,
  onToggle,
  onStart,
}: {
  course: Course
  checked: boolean
  start?: { chapter?: number; topic?: number }
  onToggle: Props['onToggleCourse']
  onStart: Props['onStart']
}) {
  const [chapters, setChapters] = useState<Opt[]>([])
  const [topics, setTopics] = useState<Opt[]>([])

  useEffect(() => {
    setChapters([])
    setTopics([])
    if (!checked) return
    apiFetch<Page<Opt>>(`/chapters?course_id=${course.id}&page=1&page_size=100`)
      .then((response) => setChapters(response.items))
  }, [checked, course.id])

  useEffect(() => {
    setTopics([])
    if (!start?.chapter) return
    apiFetch<Page<Opt>>(`/topics?chapter_id=${start.chapter}&page=1&page_size=100`)
      .then((response) => setTopics(response.items))
  }, [start?.chapter])

  function handleChapter(value: string) {
    onStart(course.id, { chapter: value ? Number(value) : undefined })
  }

  function handleTopic(value: string) {
    onStart(course.id, {
      chapter: start?.chapter,
      topic: value ? Number(value) : undefined,
    })
  }

  return (
    <Card>
      <Checkbox
        label={`${course.code} · ${course.name}`}
        checked={checked}
        onChange={(value) => onToggle(course.id, value)}
      />
      {checked && (
        <div className="stack">
          <Select
            label="Current chapter (optional)"
            value={String(start?.chapter ?? '')}
            onChange={handleChapter}
            options={[
              { value: '', label: 'Start from beginning' },
              ...chapters.map((x) => ({ value: String(x.id), label: x.name })),
            ]}
          />
          {start?.chapter && (
            <Select
              label="Current topic (optional)"
              value={String(start.topic ?? '')}
              onChange={handleTopic}
              options={[
                { value: '', label: 'Start from this chapter' },
                ...topics.map((x) => ({ value: String(x.id), label: x.name })),
              ]}
            />
          )}
        </div>
      )}
    </Card>
  )
}
