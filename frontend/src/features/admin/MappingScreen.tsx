'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type U = { id: number; name: string; code: string }
type C = { id: number; university_id: number; name: string; version: string; status: string }
type S = { id: number; curriculum_id: number; name: string; code: string; status: string }
type Course = { id: number; code: string; name: string; credit_hours: number | null; academic_scope: string; status: string }
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
  const [courses, setCourses] = useState<Course[]>([])
  const [maps, setMaps] = useState<M[]>([])
  const [universityId, setUniversityId] = useState('')
  const [curriculumId, setCurriculumId] = useState('')
  const [streamId, setStreamId] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch<{ items: U[] }>('/universities?page=1&page_size=100'),
      apiFetch<{ items: C[] }>('/curriculums?page=1&page_size=100'),
      apiFetch<{ items: S[] }>('/streams?page=1&page_size=100'),
      apiFetch<Course[]>('/university-course-mappings/courses?status_filter=ACTIVE'),
    ])
      .then(([universitiesResult, curriculumsResult, streamsResult, coursesResult]) => {
        setUniversities(universitiesResult.items)
        setCurriculums(curriculumsResult.items)
        setStreams(streamsResult.items)
        setCourses(coursesResult)
        if (universitiesResult.items[0]) {
          setUniversityId(String(universitiesResult.items[0].id))
        }
      })
      .catch((value) => setError(value instanceof Error ? value.message : 'Could not load mapping data.'))
  }, [])

  const availableCurriculums = useMemo(
    () => curriculums.filter((item) => String(item.university_id) === universityId),
    [curriculums, universityId],
  )
  const availableStreams = useMemo(
    () => streams.filter((item) => String(item.curriculum_id) === curriculumId && item.status === 'ACTIVE'),
    [streams, curriculumId],
  )
  const mapped = new Set(maps.map((item) => item.course_id))
  const filtered = courses.filter((item) => {
    const query = search.toLowerCase().trim()
    return !query || item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query)
  })

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
      apiFetch<M[]>('/university-course-mappings?stream_id=' + streamId)
        .then(setMaps)
        .catch((value) => setError(value instanceof Error ? value.message : 'Could not load mapped courses.'))
    } else {
      setMaps([])
    }
  }, [streamId])

  async function add(course: Course, semester: number) {
    setBusy(course.id)
    try {
      const order = Math.max(
        0,
        ...maps.filter((item) => item.semester_number === semester).map((item) => item.order_index),
      ) + 1
      const result = await apiFetch<M>('/university-course-mappings', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: Number(streamId),
          course_id: course.id,
          semester_number: semester,
          order_index: order,
          status: 'ACTIVE',
        }),
      })
      setMaps((items) => [...items, result])
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not add course.')
    } finally {
      setBusy(null)
    }
  }

  async function move(mapping: M) {
    setBusy(mapping.course_id)
    try {
      const semester = mapping.semester_number === 1 ? 2 : 1
      const order = Math.max(
        0,
        ...maps.filter((item) => item.semester_number === semester).map((item) => item.order_index),
      ) + 1
      const result = await apiFetch<M>('/university-course-mappings/' + mapping.id, {
        method: 'PATCH',
        body: JSON.stringify({ semester_number: semester, order_index: order }),
      })
      setMaps((items) => items.map((item) => (item.id === result.id ? result : item)))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not move course.')
    } finally {
      setBusy(null)
    }
  }

  async function remove(mapping: M) {
    if (!confirm('Remove this course from this stream? The course content will not be deleted.')) return
    setBusy(mapping.course_id)
    try {
      await apiFetch('/university-course-mappings/' + mapping.id, { method: 'DELETE' })
      setMaps((items) => items.filter((item) => item.id !== mapping.id))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not remove course.')
    } finally {
      setBusy(null)
    }
  }

  const renderMapping = (mapping: M) => (
    <div className={styles.row} key={mapping.id}>
      <div>
        <b>{mapping.course_code}</b>
        <span>{mapping.course_name}</span>
      </div>
      <button disabled={busy === mapping.course_id} onClick={() => move(mapping)}>
        Move to {mapping.semester_number === 1 ? '2' : '1'}
      </button>
      <button className={styles.danger} disabled={busy === mapping.course_id} onClick={() => remove(mapping)}>
        Remove
      </button>
    </div>
  )

  const firstSemester = maps.filter((item) => item.semester_number === 1)
  const secondSemester = maps.filter((item) => item.semester_number === 2)

  return (
    <section>
      <header className={styles.header}>
        <span>SETUP</span>
        <h1>Universities & mapping</h1>
        <p>Choose a stream, then place each course in Semester 1 or 2. Course content stays reusable.</p>
      </header>
      {error && <div className={styles.alert}>{error}</div>}
      <div className={styles.selectors}>
        <label>
          University
          <select value={universityId} onChange={(event) => setUniversityId(event.target.value)}>
            {universities.map((item) => (
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
      <div className={styles.catalog}>
        <div>
          <h2>Add a course</h2>
          <p>Search the catalog and place an unmapped course.</p>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search course code or name…" />
        {filtered.filter((item) => !mapped.has(item.id)).slice(0, 20).map((item) => (
          <div className={styles.row} key={item.id}>
            <div><b>{item.code}</b><span>{item.name}</span></div>
            <button disabled={!streamId || busy === item.id} onClick={() => add(item, 1)}>+ Semester 1</button>
            <button disabled={!streamId || busy === item.id} onClick={() => add(item, 2)}>+ Semester 2</button>
          </div>
        ))}
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
