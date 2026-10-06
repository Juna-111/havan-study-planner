'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [loading, setLoading] = useState({ universities: true, curricula: false, streams: false, courses: false })
  const [loadError, setLoadError] = useState('')

  const universityRequest = useRef(0)
  const curriculumRequest = useRef(0)
  const streamRequest = useRef(0)

  useEffect(() => {
    let cancelled = false
    setLoading((old) => ({ ...old, universities: true }))
    apiFetch<Page<Opt>>('/universities?page=1&page_size=100')
      .then((response) => {
        if (!cancelled) setUnis(response.items.filter((item) => item.status === 'ACTIVE'))
      })
      .catch((value) => {
        if (!cancelled) setLoadError(value instanceof Error ? value.message : 'Could not load universities.')
      })
      .finally(() => {
        if (!cancelled) setLoading((old) => ({ ...old, universities: false }))
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setCurricula([])
    setStreams([])
    setCourses([])
    setLoadError('')
    if (!props.university) return
    const request = ++universityRequest.current
    let cancelled = false
    setLoading((old) => ({ ...old, curricula: true }))
    apiFetch<Page<Opt>>('/curriculums?university_id=' + props.university + '&page=1&page_size=100')
      .then((response) => {
        if (!cancelled && request === universityRequest.current) {
          setCurricula(response.items.filter((item) => item.status === 'ACTIVE'))
        }
      })
      .catch((value) => {
        if (!cancelled && request === universityRequest.current) setLoadError(value instanceof Error ? value.message : 'Could not load curricula.')
      })
      .finally(() => {
        if (!cancelled && request === universityRequest.current) setLoading((old) => ({ ...old, curricula: false }))
      })
    return () => { cancelled = true }
  }, [props.university])

  useEffect(() => {
    setStreams([])
    setCourses([])
    setLoadError('')
    if (!props.curriculum) return
    const request = ++curriculumRequest.current
    let cancelled = false
    setLoading((old) => ({ ...old, streams: true }))
    apiFetch<Page<Opt>>('/streams?curriculum_id=' + props.curriculum + '&page=1&page_size=100')
      .then((response) => {
        if (!cancelled && request === curriculumRequest.current) {
          setStreams(response.items.filter((item) => item.status === 'ACTIVE'))
        }
      })
      .catch((value) => {
        if (!cancelled && request === curriculumRequest.current) setLoadError(value instanceof Error ? value.message : 'Could not load streams.')
      })
      .finally(() => {
        if (!cancelled && request === curriculumRequest.current) setLoading((old) => ({ ...old, streams: false }))
      })
    return () => { cancelled = true }
  }, [props.curriculum])

  useEffect(() => {
    setCourses([])
    setLoadError('')
    if (!props.stream) return
    const request = ++streamRequest.current
    let cancelled = false
    setLoading((old) => ({ ...old, courses: true }))
    apiFetch<Page<Course>>('/courses?stream_id=' + props.stream + '&include_freshman=true&page=1&page_size=100')
      .then((response) => {
        if (!cancelled && request === streamRequest.current) setCourses(response.items)
      })
      .catch((value) => {
        if (!cancelled && request === streamRequest.current) setLoadError(value instanceof Error ? value.message : 'Could not load courses.')
      })
      .finally(() => {
        if (!cancelled && request === streamRequest.current) setLoading((old) => ({ ...old, courses: false }))
      })
    return () => { cancelled = true }
  }, [props.stream])

  return (
    <div className="stack">
      <Card>
        <div className="stack">
          <label className="onboarding-field">
            Your name
            <input value={props.name} onChange={(e) => props.onName(e.target.value)} autoComplete="name" />
          </label>
          <Select
            label="University"
            value={props.university}
            disabled={loading.universities}
            onChange={props.onUniversity}
            options={[{ value: '', label: loading.universities ? 'Loading universities…' : 'Choose your university' }, ...unis.map((x) => ({ value: String(x.id), label: x.name }))]}
          />
          <Select
            label="Curriculum"
            value={props.curriculum}
            disabled={!props.university || loading.curricula}
            onChange={props.onCurriculum}
            options={[{ value: '', label: loading.curricula ? 'Loading curricula…' : 'Choose your curriculum' }, ...curricula.map((x) => ({ value: String(x.id), label: x.name }))]}
          />
          <div>
            <Select
              label="Stream (required)"
              value={props.stream}
              disabled={!props.curriculum || loading.streams}
              onChange={props.onStream}
              options={[{ value: '', label: loading.streams ? 'Loading streams…' : 'Choose your stream' }, ...streams.map((x) => ({ value: String(x.id), label: x.name }))]}
            />
            {props.curriculum && !loading.streams && streams.length === 0 && (
              <p className="app-copy">No active stream has been added for this curriculum yet. Ask the Havan admin to add it.</p>
            )}
          </div>
        </div>
      </Card>

      {loadError && (
        <Card>
          <p className="app-copy" role="alert">{loadError}</p>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </Card>
      )}

      <AcademicCatalogRequest universityId={props.university} />

      <Card>
        <h2>Choose your courses</h2>
        {!props.stream ? (
          <p className="app-copy">Choose your stream first. Havan will then show the courses mapped to it.</p>
        ) : loading.courses ? (
          <p className="app-copy" role="status">Loading courses…</p>
        ) : courses.length === 0 ? (
          <p className="app-copy">No active courses are mapped to this stream yet. Ask the Havan admin to review the university course mapping.</p>
        ) : (
          <div className="stack">
            {courses.map((course) => (
              <CourseChoice key={course.id} course={course} checked={props.selected.has(course.id)} start={props.starts[course.id]} onToggle={props.onToggleCourse} onStart={props.onStart} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function CourseChoice({
  course, checked, start, onToggle, onStart,
}: {
  course: Course
  checked: boolean
  start?: { chapter?: number; topic?: number }
  onToggle: Props['onToggleCourse']
  onStart: Props['onStart']
}) {
  const [chapters, setChapters] = useState<Opt[]>([])
  const [topics, setTopics] = useState<Opt[]>([])
  const [chapterLoading, setChapterLoading] = useState(false)
  const [topicLoading, setTopicLoading] = useState(false)
  const chapterRequest = useRef(0)
  const topicRequest = useRef(0)

  useEffect(() => {
    setChapters([])
    setTopics([])
    if (!checked) return
    const request = ++chapterRequest.current
    let cancelled = false
    setChapterLoading(true)
    apiFetch<Page<Opt>>('/chapters?course_id=' + course.id + '&page=1&page_size=100')
      .then((response) => {
        if (!cancelled && request === chapterRequest.current) setChapters(response.items.filter((item) => item.status === 'ACTIVE'))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled && request === chapterRequest.current) setChapterLoading(false)
      })
    return () => { cancelled = true }
  }, [checked, course.id])

  useEffect(() => {
    setTopics([])
    if (!start?.chapter) return
    const request = ++topicRequest.current
    let cancelled = false
    setTopicLoading(true)
    apiFetch<Page<Opt>>('/topics?chapter_id=' + start.chapter + '&page=1&page_size=100')
      .then((response) => {
        if (!cancelled && request === topicRequest.current) setTopics(response.items.filter((item) => item.status === 'ACTIVE'))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled && request === topicRequest.current) setTopicLoading(false)
      })
    return () => { cancelled = true }
  }, [start?.chapter])

  function handleChapter(value: string) {
    onStart(course.id, { chapter: value ? Number(value) : undefined })
  }

  function handleTopic(value: string) {
    onStart(course.id, { chapter: start?.chapter, topic: value ? Number(value) : undefined })
  }

  return (
    <Card>
      <Checkbox label={course.code + ' · ' + course.name} checked={checked} onChange={(value) => onToggle(course.id, value)} />
      {checked && (
        <div className="stack">
          <Select
            label="Current chapter (optional)"
            value={String(start?.chapter ?? '')}
            disabled={chapterLoading}
            onChange={handleChapter}
            options={[{ value: '', label: chapterLoading ? 'Loading chapters…' : 'Start from beginning' }, ...chapters.map((x) => ({ value: String(x.id), label: x.name }))]}
          />
          {start?.chapter && (
            <Select
              label="Current topic (optional)"
              value={String(start.topic ?? '')}
              disabled={topicLoading}
              onChange={handleTopic}
              options={[{ value: '', label: topicLoading ? 'Loading topics…' : 'Start from this chapter' }, ...topics.map((x) => ({ value: String(x.id), label: x.name }))]}
            />
          )}
        </div>
      )}
    </Card>
  )
}
