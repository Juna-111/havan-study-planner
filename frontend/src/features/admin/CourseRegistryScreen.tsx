'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type Course = { id: number; code: string; name: string; description?: string | null; credit_hours?: number | null; status: string }
export default function CourseRegistryScreen({ onImport }: { onImport?: () => void }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<{ items: Course[] }>('/courses?page=1&page_size=100')
      .then((value) => setCourses(value.items))
      .catch((value) => setError(value instanceof Error ? value.message : 'Could not load Course Registry.'))
  }, [])

  const visibleCourses = useMemo(() => {
    const q = search.trim().toLowerCase()
    return courses.filter((course) =>
      (status === 'ALL' || course.status === status) &&
      (!q || course.code.toLowerCase().includes(q) || course.name.toLowerCase().includes(q)),
    )
  }, [courses, search, status])

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
        <p>Upload a course TXT or MD file through Import. Manual course creation is intentionally disabled so university mappings can never create duplicate course records.</p>
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
          <div className={styles.row} key={course.id}>
            <div><b>{course.code} · {course.name}</b><small>{course.status} · Registry ID #{course.id}{course.credit_hours == null ? '' : ' · ' + course.credit_hours + ' credits'}</small></div>
            <span>Managed by course TXT/MD import</span>
          </div>
        ))}
      </div>
    </section>
  )
}
