'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type Course = { id: number; code: string; name: string; description?: string | null; credit_hours?: number | null; status: string; academic_scope?: string; content_version?: string }
export default function CourseRegistryScreen({ onImport }: { onImport?: () => void }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch<Course[]>('/freshman-registry/courses')
      .then(setCourses)
      .catch((value) => setError(value instanceof Error ? value.message : 'Could not load Course Registry.'))
  }, [])

  const visibleCourses = useMemo(() => {
    const q = search.trim().toLowerCase()
    return courses.filter((course) =>
      (status === 'ALL' || course.status === status) &&
      (!q || course.code.toLowerCase().includes(q) || course.name.toLowerCase().includes(q)),
    )
  }, [courses, search, status])

  function editCourse(course: Course) {
    setError('')
    setEditingId(course.id)
    setDraft({ description: course.description || '' })
  }

  async function saveCourse(course: Course) {
    setSaving(true)
    setError('')
    try {
      const updated = await apiFetch<{ description?: string | null }>(`/freshman-registry/courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ description: draft.description || null }),
      })
      setCourses((current) => current.map((item) => item.id === course.id ? { ...item, ...updated } : item))
      setEditingId(null)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not update this course.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <header className={styles.header}>
        <span>CONTENT · COURSE REGISTRY</span>
        <h1>Canonical Course Registry</h1>
        <p>Courses are created, updated, versioned, and populated from the course TXT/MD source. University CSV files only map existing registry courses.</p>
      </header>
      {error && <div className={styles.alert}>{error}</div>}
      <div className={styles.notice}>
        <h2>Automatic course ingestion</h2>
        <p>Course identity and learning content come from the uploaded source. You can edit local study details and availability without changing the imported course identity.</p>
        {onImport && <button className={styles.primary} onClick={onImport}>Import course content</button>}
      </div>
      <div className={styles.stats}>
        <div><span>Total registry courses</span><b>{courses.length}</b></div>
        <div><span>Active</span><b>{courses.filter((item) => item.status === 'ACTIVE').length}</b></div>
        <div><span>Inactive</span><b>{courses.filter((item) => item.status !== 'ACTIVE').length}</b></div>
        <div><span>Filtered</span><b>{visibleCourses.length}</b></div>
      </div>
      <div className={styles.selectors}>
        <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
        </select></label>
        <label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="FLEn 1011, Psychology…" /></label>
      </div>
      <div className={styles.list}>
        <div className={styles.crudHead}><div><h2>Registered courses</h2><p>Read-only verification of the canonical registry.</p></div><b>{visibleCourses.length}</b></div>
        {!visibleCourses.length && <div className={styles.empty}>No courses match the current filters.</div>}
        {visibleCourses.map((course) => (
          <article className={styles.topicAdminCard} key={course.id}>
            <div className={styles.topicAdminSummary}><div><b>{course.code} · {course.name}</b><small>{course.status} · Version {course.content_version || '1.0'} · {course.credit_hours == null ? 'Credits not set' : `${course.credit_hours} credits`}</small></div><button className={styles.rowAction} onClick={() => editCourse(course)}>{editingId === course.id ? 'Editing' : 'Edit course settings'}</button></div>
            {editingId === course.id && <div className={styles.topicEditor}>
              <label className={styles.topicDescription}>Admin note<textarea value={draft.description} onChange={(event) => setDraft({ description: event.target.value })} maxLength={10000} placeholder="Optional local course note" /></label>
              <div className={styles.actions}><button onClick={() => setEditingId(null)}>Cancel</button><button className={styles.primary} disabled={saving} onClick={() => void saveCourse(course)}>{saving ? 'Saving…' : 'Save course settings'}</button></div>
            </div>}
          </article>
        ))}
      </div>
    </section>
  )
}
