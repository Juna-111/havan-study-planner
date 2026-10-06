'use client'

import { useEffect, useState } from 'react'
import { Card, Checkbox, Select } from '@/components/ui'
import { apiFetch } from '@/lib/api'

type Opt = { id: number; name: string }
type Course = { id: number; course_name: string }
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
  useEffect(() => { apiFetch<Opt[]>('/universities?page=1&page_size=100').then(setUnis) }, [])
  useEffect(() => { if (props.university) apiFetch<Opt[]>(`/curriculums?university_id=${props.university}&page=1&page_size=100`).then(setCurricula) }, [props.university])
  useEffect(() => { if (props.curriculum) apiFetch<Opt[]>(`/streams?curriculum_id=${props.curriculum}&page=1&page_size=100`).then(setStreams) }, [props.curriculum])
  useEffect(() => { if (props.stream) apiFetch<Course[]>(`/courses?stream_id=${props.stream}&include_freshman=true&page=1&page_size=100`).then(setCourses) }, [props.stream])

  return <div className="stack">
    <Card>
      <div className="stack">
        <label className="field">Your name<input value={props.name} onChange={(e) => props.onName(e.target.value)} /></label>
        <Select label="University" value={props.university} onChange={props.onUniversity} options={unis.map((x) => ({ value: String(x.id), label: x.name }))} />
        <Select label="Curriculum" value={props.curriculum} onChange={props.onCurriculum} options={curricula.map((x) => ({ value: String(x.id), label: x.name }))} />
        <Select label="Stream" value={props.stream} onChange={props.onStream} options={streams.map((x) => ({ value: String(x.id), label: x.name }))} />
      </div>
    </Card>
    <Card><h2>Choose your courses</h2><div className="stack">{courses.map((course) => <CourseChoice key={course.id} course={course} checked={props.selected.has(course.id)} start={props.starts[course.id]} onToggle={props.onToggleCourse} onStart={props.onStart} />)}</div></Card>
  </div>
}

function CourseChoice({ course, checked, start, onToggle, onStart }: { course: Course; checked: boolean; start?: { chapter?: number; topic?: number }; onToggle: Props['onToggleCourse']; onStart: Props['onStart'] }) {
  const [chapters, setChapters] = useState<Opt[]>([])
  const [topics, setTopics] = useState<Opt[]>([])
  useEffect(() => { if (checked) apiFetch<{ items: Opt[] }>(`/chapters?course_id=${course.id}&page=1&page_size=100`).then((x) => setChapters(x.items)) }, [checked, course.id])
  useEffect(() => { if (start?.chapter) apiFetch<{ items: Opt[] }>(`/topics?chapter_id=${start.chapter}&page=1&page_size=100`).then((x) => setTopics(x.items)) }, [start?.chapter])
  return <Card><Checkbox label={course.course_name} checked={checked} onChange={(value) => onToggle(course.id, value)} />{checked && <div className="stack">
    <Select label="Current chapter (optional)" value={String(start?.chapter ?? '')} onChange={(value) => onStart(course.id, { chapter: value ? Number(value) : undefined })} options={[{ value: '', label: 'Start from beginning' }, ...chapters.map((x) => ({ value: String(x.id), label: x.name }))]} />
    {start?.chapter && <Select label="Current topic (optional)" value={String(start.topic ?? '')} onChange={(value) => onStart(course.id, { chapter: start.chapter, topic: value ? Number(value) : undefined })} options={[{ value: '', label: 'Start from this chapter' }, ...topics.map((x) => ({ value: String(x.id), label: x.name }))]} />}
  </div>}</Card>
}
