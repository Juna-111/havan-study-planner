'use client'
import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'
type Course = {
  id: number
  stream_id?: number | null
  code: string
  name: string
  description?: string | null
  credit_hours?: number | null
  status: string
}
type Stream = { id: number; curriculum_id: number; name: string; code: string; status: string }
type Curriculum = { id: number; university_id: number; name: string; version: string; status: string }
type University = { id: number; name: string; code: string; status: string }
export default function CourseRegistryScreen() {
  const [courses, setCourses] = useState<Course[]>([])
  const [universities, setUniversities] = useState<University[]>([])
  const [curriculums, setCurriculums] = useState<Curriculum[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [universityId, setUniversityId] = useState('')
  const [curriculumId, setCurriculumId] = useState('')
  const [streamId, setStreamId] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [selected, setSelected] = useState<Course | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState({ stream_id: '', code: '', name: '', description: '', credit_hours: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  async function load() {
    try {
      setError('')
      const [courseResult, universityResult, curriculumResult, streamResult] = await Promise.all([
        apiFetch<{ items: Course[] }>('/courses?page=1&page_size=100'),
        apiFetch<{ items: University[] }>('/universities?page=1&page_size=100'),
        apiFetch<{ items: Curriculum[] }>('/curriculums?page=1&page_size=100'),
        apiFetch<{ items: Stream[] }>('/streams?page=1&page_size=100'),
      ])
      setCourses(courseResult.items)
      setUniversities(universityResult.items)
      setCurriculums(curriculumResult.items)
      setStreams(streamResult.items)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load Course Registry.')
    }
  }
  useEffect(() => { void load() }, [])
  const visibleCurriculums = useMemo(
    () => curriculums.filter((item) => !universityId || String(item.university_id) === universityId),
    [curriculums, universityId],
  )
  const visibleStreams = useMemo(
    () => streams.filter((item) => !curriculumId || String(item.curriculum_id) === curriculumId),
    [streams, curriculumId],
  )
  const visibleCourses = useMemo(() => {
    const query = search.trim().toLowerCase()
    return courses.filter((course) => {
      const matchesStream = !streamId || String(course.stream_id) === streamId
      const matchesStatus = status === 'ALL' || course.status === status
      const matchesSearch = !query || course.code.toLowerCase().includes(query) || course.name.toLowerCase().includes(query)
      return matchesStream && matchesStatus && matchesSearch
    })
  }, [courses, search, status, streamId])
  function selectUniversity(value: string) {
    setUniversityId(value)
    setCurriculumId('')
    setStreamId('')
  }
  function selectCurriculum(value: string) {
    setCurriculumId(value)
    setStreamId('')
  }
  function beginEdit(course: Course) {
    setEditing(course.id)
    setForm({
      stream_id: course.stream_id ? String(course.stream_id) : streamId,
      code: course.code,
      name: course.name,
      description: course.description || '',
      credit_hours: course.credit_hours == null ? '' : String(course.credit_hours),
    })
    setSelected(null)
    setError('')
  }
  function resetForm() {
    setEditing(null)
    setForm({ stream_id: streamId, code: '', name: '', description: '', credit_hours: '' })
  }
  async function saveCourse() {
    if (!form.stream_id || !form.code.trim() || !form.name.trim()) return
    setBusy(editing ? 'edit-' + editing : 'add')
    setError('')
    try {
      const body = {
        stream_id: Number(form.stream_id),
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        credit_hours: form.credit_hours ? Number(form.credit_hours) : null,
        ...(editing ? {} : { status: 'ACTIVE' }),
      }
      await apiFetch(editing ? '/courses/' + editing : '/courses', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(editing ? { ...body, stream_id: undefined } : body),
      })
      resetForm()
      await load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save course.')
    } finally {
      setBusy('')
    }
  }
  async function toggleStatus(course: Course) {
    const next = course.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    if (!window.confirm((next === 'ACTIVE' ? 'Activate ' : 'Deactivate ') + course.code + '? Course content remains attached to the same Course Registry record.')) return
    setBusy(String(course.id))
    setError('')
    try {
      await apiFetch('/courses/' + course.id, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      setSelected(null)
      await load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not change course status.')
    } finally {
      setBusy('')
    }
  }
  const activeCount = courses.filter((item) => item.status === 'ACTIVE').length
  const inactiveCount = courses.length - activeCount
  return (
    <section>
      <header className={styles.header}>
        <span>CONTENT · COURSE REGISTRY</span>
        <h1>One canonical home for courses</h1>
        <p>Course Registry owns the course record. University and stream mapping decides where a course is used; it does not create another copy.</p>
      </header>
      {error && <div className={styles.alert}>{error}</div>}
      <div className={styles.stats}>
        <div><span>Total registry courses</span><b>{courses.length}</b></div>
        <div><span>Active</span><b>{activeCount}</b></div>
        <div><span>Inactive</span><b>{inactiveCount}</b></div>
        <div><span>Filtered view</span><b>{visibleCourses.length}</b></div>
      </div>
      <div className={styles.selectors}>
        <label>University
          <select value={universityId} onChange={(event) => selectUniversity(event.target.value)}>
            <option value="">All universities</option>
            {universities.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </select>
        </label>
        <label>Curriculum
          <select value={curriculumId} onChange={(event) => selectCurriculum(event.target.value)}>
            <option value="">All curricula</option>
            {visibleCurriculums.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}
          </select>
        </label>
        <label>Stream
          <select value={streamId} onChange={(event) => setStreamId(event.target.value)}>
            <option value="">All streams</option>
            {visibleStreams.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <label>Search
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="PHY101, Physics…" />
        </label>
      </div>
      <div className={styles.list}>
        <div className={styles.crudHead}>
          <div>
            <h2>Canonical courses</h2>
            <p>Open a course to inspect its identity and content entry point.</p>
          </div>
          <b>{visibleCourses.length}</b>
        </div>
        {!visibleCourses.length && <div className={styles.empty}>No courses match the current filters.</div>}
        {visibleCourses.map((course) => (
          <div className={styles.row} key={course.id}>
            <div>
              <b>{course.code} · {course.name}</b>
              <small>{course.status} · Registry ID #{course.id}{course.credit_hours == null ? '' : ' · ' + course.credit_hours + ' credits'}</small>
            </div>
            <div className={styles.actions}>
              <button onClick={() => setSelected(course)}>Inspect</button>
              <button onClick={() => beginEdit(course)}>Edit</button>
              <button
                className={course.status === 'ACTIVE' ? styles.danger : styles.primary}
                disabled={busy === String(course.id)}
                onClick={() => toggleStatus(course)}
              >
                {busy === String(course.id) ? 'Saving…' : course.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.editor}>
        <div className={styles.crudHead}>
          <div><span>{editing ? 'REGISTRY EDIT' : 'REGISTRY CREATE'}</span><h2>{editing ? 'Edit course' : 'Add canonical course'}</h2></div>
          {editing && <button onClick={resetForm}>Cancel</button>}
        </div>
        <p>Every course must belong to a real stream record. Mapping determines academic use; this screen owns the course record.</p>
        <label>Stream
          <select value={form.stream_id || streamId} onChange={(event) => setForm((old) => ({ ...old, stream_id: event.target.value }))}>
            <option value="">Choose stream</option>
            {streams.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </select>
        </label>
        <label>Course code<input value={form.code} onChange={(event) => setForm((old) => ({ ...old, code: event.target.value }))} placeholder="PHY101" /></label>
        <label>Course name<input value={form.name} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} placeholder="Physics" /></label>
        <label>Credit hours<input type="number" min="0" max="30" value={form.credit_hours} onChange={(event) => setForm((old) => ({ ...old, credit_hours: event.target.value }))} /></label>
        <label>Description<textarea value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} rows={3} /></label>
        <button className={styles.primary} disabled={busy === 'add' || (editing !== null && busy === 'edit-' + editing) || !form.stream_id || !form.code.trim() || !form.name.trim()} onClick={saveCourse}>
          {busy ? 'Saving…' : editing ? 'Save course' : 'Add course'}
        </button>
      </div>
      {selected && (
        <div className={styles.panel}>
          <div className={styles.crudHead}>
            <div>
              <span>REGISTRY RECORD</span>
              <h2>{selected.code} · {selected.name}</h2>
            </div>
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className={styles.indent}>
            <span>Registry ID: #{selected.id}</span>
            <span>Status: {selected.status}</span>
            <span>Course ownership stays here. Mapping belongs to the academic mapping workspace.</span>
            <span>Chapters and topics must attach to this course record rather than a copied course.</span>
          </div>
        </div>
      )}
    </section>
  )
}
