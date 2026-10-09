'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type U = { id: number; name: string; code: string; status: string }
type C = { id: number; university_id: number; name: string; version: string; status: string }
type S = { id: number; curriculum_id: number; name: string; code: string; status: string }
type M = {
  id: number
  stream_id: number
  course_id: number
  course_code: string
  course_name: string
  credit_hours: number | null
  semester_number: number
  order_index: number
}

export default function MappingScreen() {
  const [universities, setUniversities] = useState<U[]>([])
  const [curriculums, setCurriculums] = useState<C[]>([])
  const [streams, setStreams] = useState<S[]>([])
  const [maps, setMaps] = useState<M[]>([])
  const [universityId, setUniversityId] = useState('')
  const [curriculumId, setCurriculumId] = useState('')
  const [streamId, setStreamId] = useState('')
  const [error, setError] = useState('')
  const selectedUniversity = universities.find((item) => String(item.id) === universityId)
  const selectedCurriculum = curriculums.find((item) => String(item.id) === curriculumId)
  const selectedStream = streams.find((item) => String(item.id) === streamId)

  useEffect(() => {
    Promise.all([
      apiFetch<{ items: U[] }>('/universities?page=1&page_size=100'),
      apiFetch<{ items: C[] }>('/curriculums?page=1&page_size=100'),
      apiFetch<{ items: S[] }>('/streams?page=1&page_size=100'),
    ])
      .then(([universitiesResult, curriculumsResult, streamsResult]) => {
        setUniversities(universitiesResult.items)
        setCurriculums(curriculumsResult.items)
        setStreams(streamsResult.items)
        const firstActiveUniversity = universitiesResult.items.find((item) => item.status === 'ACTIVE')
        if (firstActiveUniversity) {
          setUniversityId(String(firstActiveUniversity.id))
        }
      })
      .catch((value) => setError(value instanceof Error ? value.message : 'Could not load mapping data.'))
  }, [])

  const availableCurriculums = useMemo(
    () => curriculums.filter((item) => String(item.university_id) === universityId && item.status === 'ACTIVE'),
    [curriculums, universityId],
  )
  const availableStreams = useMemo(
    () => streams.filter((item) => String(item.curriculum_id) === curriculumId && item.status === 'ACTIVE'),
    [streams, curriculumId],
  )
  useEffect(() => {
    const item = availableCurriculums.find((value) => value.status === 'ACTIVE') || availableCurriculums[0]
    setCurriculumId(item ? String(item.id) : '')
  }, [availableCurriculums])

  useEffect(() => {
    const item = availableStreams[0]
    setStreamId(item ? String(item.id) : '')
  }, [availableStreams])

  useEffect(() => {
    if (streamId) {
      apiFetch<M[]>('/university-course-offerings?stream_id=' + streamId)
        .then(setMaps)
        .catch((value) => setError(value instanceof Error ? value.message : 'Could not load mapped courses.'))
    } else {
      setMaps([])
    }
  }, [streamId])

    const renderMapping = (mapping: M) => (
    <div className={styles.row} key={mapping.id}>
      <div>
        <b>{mapping.course_code}</b>
        <span>{mapping.course_name}</span>
      </div>

    </div>
  )

  const firstSemester = maps.filter((item) => item.semester_number === 1)
  const secondSemester = maps.filter((item) => item.semester_number === 2)

  return (
    <section>
      <header className={styles.header}>
        <span>ACADEMIC SETUP · COURSE MAPPING</span>
        <h1>Course mapping</h1>
        <p>Review the active courses in each semester. The university CSV is the source of truth for adding, moving or archiving offerings.</p>
      </header>
      {error && <div className={styles.alert}>{error}</div>}
      {selectedUniversity && selectedCurriculum && selectedStream && (
        <div className={styles.health}>
          <div><b>Mapping path</b><span>{selectedUniversity.code} · {selectedUniversity.name} → {selectedCurriculum.name} · v{selectedCurriculum.version} → {selectedStream.code} · {selectedStream.name}</span></div>
          <small>Active academic path</small>
        </div>
      )}
      <div className={styles.selectors}>
        <label>
          University
          <select value={universityId} onChange={(event) => setUniversityId(event.target.value)}>
            {universities.filter((item) => item.status === 'ACTIVE').map((item) => (
              <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Curriculum
          <select value={curriculumId} onChange={(event) => setCurriculumId(event.target.value)}>
            {availableCurriculums.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>
            ))}
          </select>
        </label>
        <label>
          Stream
          <select value={streamId} onChange={(event) => setStreamId(event.target.value)}>
            {availableStreams.map((item) => (
              <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.notice}>
        <h2>Update this stream from its source file</h2>
        <p>Choose Update catalog to preview a university CSV. Havan validates the complete semester list before applying any changes.</p>
      </div>
      <div className={styles.semesters}>
        <div className={styles.panel}>
          <h2>Semester 1 <small>{firstSemester.length} courses</small></h2>
          {firstSemester.map(renderMapping)}
          {!firstSemester.length && <p className={styles.empty}>No courses mapped yet.</p>}
        </div>
        <div className={styles.panel}>
          <h2>Semester 2 <small>{secondSemester.length} courses</small></h2>
          {secondSemester.map(renderMapping)}
          {!secondSemester.length && <p className={styles.empty}>No courses mapped yet.</p>}
        </div>
      </div>
    </section>
  )
}
