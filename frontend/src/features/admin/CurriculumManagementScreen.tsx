'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type University = { id: number; name: string; code: string; status: string }
type Curriculum = { id: number; university_id: number; name: string; version: string; academic_year?: string | null; status: string }
type Stream = { id: number; curriculum_id: number; name: string; code: string; status: string }
type Course = { id: number; stream_id?: number | null; code: string; name: string; credit_hours?: number | null; status: string }
type Mapping = { id: number; stream_id: number; course_id: number; course_code: string; course_name: string; semester_number: number; status: string }

export default function CurriculumManagementScreen() {
  const [universities, setUniversities] = useState<University[]>([])
  const [curriculums, setCurriculums] = useState<Curriculum[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [universityId, setUniversityId] = useState('')
  const [curriculumId, setCurriculumId] = useState('')
  const [streamId, setStreamId] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      setError('')
      const [u, c, s] = await Promise.all([
        apiFetch<{ items: University[] }>('/universities?page=1&page_size=100'),
        apiFetch<{ items: Curriculum[] }>('/curriculums?page=1&page_size=100'),
        apiFetch<{ items: Stream[] }>('/streams?page=1&page_size=100'),
      ])
      setUniversities(u.items)
      setCurriculums(c.items)
      setStreams(s.items)
      const activeUniversity = u.items.find((item) => item.status === 'ACTIVE')
      const nextUniversity = universityId || (activeUniversity ? String(activeUniversity.id) : '')
      setUniversityId(nextUniversity)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load curriculum hierarchy.')
    }
  }

  async function loadCourses(id: string) {
    if (!id) {
      setCourses([])
      setMappings([])
      return
    }
    try {
      const [courseResult, mappingResult] = await Promise.all([
        apiFetch<{ items: Course[] }>(`/courses?stream_id=${id}&page=1&page_size=100`),
        apiFetch<Mapping[]>(`/university-course-offerings?stream_id=${id}`),
      ])
      setCourses(courseResult.items)
      setMappings(mappingResult)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load dependencies for this stream.')
      setCourses([])
      setMappings([])
    }
  }

  useEffect(() => { load() }, [])

  const visibleCurriculums = useMemo(
    () => curriculums.filter((item) => String(item.university_id) === universityId),
    [curriculums, universityId],
  )
  const visibleStreams = useMemo(
    () => streams.filter((item) => String(item.curriculum_id) === curriculumId),
    [streams, curriculumId],
  )
  const selectedUniversity = universities.find((item) => String(item.id) === universityId)
  const selectedCurriculum = curriculums.find((item) => String(item.id) === curriculumId)
  const selectedStream = streams.find((item) => String(item.id) === streamId)
  const selectedUniversityCurriculums = curriculums.filter((item) => item.university_id === selectedUniversity?.id)
  const selectedCurriculumStreams = streams.filter((item) => item.curriculum_id === selectedCurriculum?.id)
  const activeMappings = mappings.filter((item) => item.status === 'ACTIVE')

  useEffect(() => {
    const first = visibleCurriculums.find((item) => item.status === 'ACTIVE') || visibleCurriculums[0]
    setCurriculumId(first ? String(first.id) : '')
  }, [universityId, curriculums])

  useEffect(() => {
    const first = visibleStreams.find((item) => item.status === 'ACTIVE') || visibleStreams[0]
    setStreamId(first ? String(first.id) : '')
  }, [curriculumId, streams])

  useEffect(() => {
    void loadCourses(streamId)
  }, [streamId])

  return (
    <section>
      <header className={styles.header}>
        <span>SETUP · CURRICULUM MANAGEMENT</span>
        <h1>Explore the academic hierarchy</h1>
        <p>Choose a university, curriculum and stream to see what students can select. Use Course offerings for semester-by-semester review.</p>
      </header>

      {error && <div className={styles.alert}>{error}</div>}

      <div className={styles.health}>
        <div>
          <span>Current hierarchy</span>
          <b>{selectedUniversity?.code || '—'} → {selectedCurriculum ? `v${selectedCurriculum.version}` : '—'} → {selectedStream?.code || '—'}</b>
        </div>
        <span>{courses.length} course{courses.length === 1 ? '' : 's'} in selected stream</span>
      </div>

      <div className={styles.stats}>
        <div><span>University curricula</span><b>{selectedUniversityCurriculums.length}</b></div>
        <div><span>Curriculum streams</span><b>{selectedCurriculumStreams.length}</b></div>
        <div><span>Registered courses</span><b>{courses.length}</b></div>
        <div><span>Active course offerings</span><b>{activeMappings.length}</b></div>
      </div>

      <div className={styles.selectors}>
        <label>University
          <select value={universityId} onChange={(event) => setUniversityId(event.target.value)}>
            <option value="">Choose university</option>
            {universities.map((item) => (
              <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
            ))}
          </select>
        </label>
        <label>Curriculum
          <select value={curriculumId} onChange={(event) => setCurriculumId(event.target.value)}>
            <option value="">Choose curriculum</option>
            {visibleCurriculums.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>
            ))}
          </select>
        </label>
        <label>Stream
          <select value={streamId} onChange={(event) => setStreamId(event.target.value)}>
            <option value="">Choose stream</option>
            {visibleStreams.map((item) => (
              <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.catalog}>
        <div className={styles.crudHead}>
          <div>
            <h2>Selected stream</h2>
            <p>{selectedStream ? `${selectedStream.code} · ${selectedStream.name}` : 'Choose a stream to inspect its courses.'}</p>
            {selectedStream && <small>{selectedStream.status} · curriculum ID #{selectedStream.curriculum_id}</small>}
          </div>
          <b>{courses.length}</b>
        </div>

        {!courses.length && selectedStream && (
          <div className={styles.empty}>No courses are registered directly under this stream yet.</div>
        )}

        {courses.map((course) => (
          <div className={styles.row} key={course.id}>
            <div>
              <b>{course.code}</b>
              <span>{course.name}</span>
              <small>{course.credit_hours == null ? 'Credit hours not set' : `${course.credit_hours} credit hours`}</small>
            </div>
            <small>{course.status}</small>
            <span>{activeMappings.some((item) => item.course_id === course.id) ? 'Mapped' : 'Not mapped'} · Registry ID #{course.id}</span>
          </div>
        ))}
      </div>

      <div className={styles.panel}>
        <h2>Hierarchy dependencies</h2>
        <div className={styles.indent}>
          <span>University contains {selectedUniversityCurriculums.length} curriculum record{selectedUniversityCurriculums.length === 1 ? '' : 's'}.</span>
          <span>Selected curriculum contains {selectedCurriculumStreams.length} stream record{selectedCurriculumStreams.length === 1 ? '' : 's'}.</span>
          <span>Selected stream exposes {courses.length} registered course record{courses.length === 1 ? '' : 's'} and {activeMappings.length} active mapping{activeMappings.length === 1 ? '' : 's'}.</span>
          <span>Mapping is a separate relationship; inspecting this hierarchy does not create or duplicate course records.</span>
        </div>
      </div>

      <div className={styles.panel}>
        <h2>Identity rules</h2>
        <div className={styles.indent}>
          <span>University is identified by its stable record ID and code.</span>
          <span>Curriculum belongs to one university and keeps its own version.</span>
          <span>Stream belongs to one curriculum and has a stable code.</span>
          <span>Courses are inspected by their stable registry ID, not by display name alone.</span>
        </div>
      </div>
    </section>
  )
}
