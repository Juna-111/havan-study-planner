'use client'
import { useEffect, useRef, useState } from 'react'
import { Button, Card, Select } from '@/components/ui'
import CourseChoice from './CourseChoice'
import { apiFetchAllPages } from '@/lib/api'
import AcademicCatalogRequest from './AcademicCatalogRequest'
type Opt = { id: number; name: string; status?: string }
type Course = { id: number; code: string; name: string }
type Props = {
  name: string
  university: string
  stream: string
  selected: Set<number>
  onName: (value: string) => void
  onUniversity: (value: string) => void
  onStream: (value: string) => void
  onToggleCourse: (id: number, checked: boolean) => void
  onRetryLoad?: () => void
}
export default function StepAcademic(props: Props) {
  const [unis, setUnis] = useState<Opt[]>([])
  const [streams, setStreams] = useState<Opt[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState({ universities: true, streams: false, courses: false })
  const [loadError, setLoadError] = useState('')
  const universityRequest = useRef(0)
  const streamRequest = useRef(0)

  const loadUnis = () => {
    let cancelled = false
    setLoading((old) => ({ ...old, universities: true }))
    setLoadError('')
    apiFetchAllPages<Opt>('/universities')
      .then((response) => {
        if (!cancelled) setUnis(response.filter((item) => item.status === 'ACTIVE'))
      })
      .catch((value) => {
        if (!cancelled) setLoadError(value instanceof Error ? value.message : 'Could not load universities.')
      })
      .finally(() => {
        if (!cancelled) setLoading((old) => ({ ...old, universities: false }))
      })
    return () => { cancelled = true }
  }

  useEffect(() => {
    loadUnis()
  }, [])
  useEffect(() => {
    setStreams([])
    setCourses([])
    setLoadError('')
    if (!props.university) return
    const request = ++universityRequest.current
    let cancelled = false
    setLoading((old) => ({ ...old, streams: true }))
    apiFetchAllPages<Opt>('/streams?university_id=' + props.university)
      .then((response) => {
        if (!cancelled && request === universityRequest.current) setStreams(response.filter((item) => item.status === 'ACTIVE'))
      })
      .catch((value) => {
        if (!cancelled && request === universityRequest.current) setLoadError(value instanceof Error ? value.message : 'Could not load streams.')
      })
      .finally(() => {
        if (!cancelled && request === universityRequest.current) setLoading((old) => ({ ...old, streams: false }))
      })
    return () => { cancelled = true }
  }, [props.university])
  useEffect(() => {
    setCourses([])
    setLoadError('')
    if (!props.stream) return
    const request = ++streamRequest.current
    let cancelled = false
    setLoading((old) => ({ ...old, courses: true }))
    apiFetchAllPages<Course>('/courses?stream_id=' + props.stream + '&include_freshman=true')
      .then((response) => {
        if (!cancelled && request === streamRequest.current) setCourses(response)
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
    <div className="stack academic-step onboarding-academic-step">
      <Card className="onboarding-academic-card">
        <div className="stack onboarding-academic-fields">
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
          <div>
            <Select
              label="Stream (required)"
              value={props.stream}
              disabled={!props.university || loading.streams}
              onChange={props.onStream}
              options={[{ value: '', label: loading.streams ? 'Loading streams…' : 'Choose your stream' }, ...streams.map((x) => ({ value: String(x.id), label: x.name }))]}
            />
            {props.university && !loading.streams && streams.length === 0 && (
              <p className="app-copy">No active stream has been added for this university yet. Ask the Havan admin to add it.</p>
            )}
          </div>
        </div>
      </Card>
      {loadError && (
        <Card>
          <p className="app-copy" role="alert">{loadError}</p>
          <Button variant="secondary" onClick={() => loadUnis()}>Retry loading</Button>
        </Card>
      )}
      <AcademicCatalogRequest universityId={props.university} />
      <Card className="onboarding-course-section">
        <div className="onboarding-section-heading"><span className="app-eyebrow">YOUR COURSES</span><h2>Choose your courses</h2><p className="app-copy">Pick the courses Havan should work with. Choose the exact chapters and topics later when building Today, Week, or Month.</p></div>
        {!props.stream ? (
          <p className="app-copy">Choose your stream first. Havan will then show the courses mapped to it.</p>
        ) : loading.courses ? (
          <p className="app-copy" role="status">Loading courses…</p>
        ) : courses.length === 0 ? (
          <p className="app-copy">No active courses are mapped to this stream yet. Ask the Havan admin to review the university course mapping.</p>
        ) : (
          <div className="stack">
            {courses.map((course) => (
              <CourseChoice key={course.id} course={course} checked={props.selected.has(course.id)} onToggle={props.onToggleCourse} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
