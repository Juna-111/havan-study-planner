'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type University = { id: number; name: string; code: string; status: string }
type Curriculum = { id: number; university_id: number; name: string; version: string; status: string }
type Stream = { id: number; curriculum_id: number; name: string; code: string; status: string }

export default function StreamManagementScreen() {
  const [universities, setUniversities] = useState<University[]>([])
  const [curriculums, setCurriculums] = useState<Curriculum[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [universityId, setUniversityId] = useState('')
  const [curriculumId, setCurriculumId] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch<{ items: University[] }>('/universities?page=1&page_size=100'),
      apiFetch<{ items: Curriculum[] }>('/curriculums?page=1&page_size=100'),
      apiFetch<{ items: Stream[] }>('/streams?page=1&page_size=100'),
    ]).then(([u, c, s]) => {
      setUniversities(u.items)
      setCurriculums(c.items)
      setStreams(s.items)
      const first = u.items.find((item) => item.status === 'ACTIVE')
      if (first) setUniversityId(String(first.id))
    }).catch((value) => setError(value instanceof Error ? value.message : 'Could not load stream data.'))
  }, [])

  const visibleCurriculums = useMemo(
    () => curriculums.filter((item) => String(item.university_id) === universityId),
    [curriculums, universityId],
  )
  useEffect(() => {
    const first = visibleCurriculums.find((item) => item.status === 'ACTIVE') || visibleCurriculums[0]
    setCurriculumId(first ? String(first.id) : '')
  }, [visibleCurriculums])

  const visibleStreams = useMemo(() => {
    const source = streams.filter((item) => String(item.curriculum_id) === curriculumId)
    const q = search.trim().toLowerCase()
    return q ? source.filter((item) => item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)) : source
  }, [streams, curriculumId, search])

  return (
    <section>
      <header className={styles.header}>
        <span>ACADEMIC SETUP · STREAMS</span>
        <h1>Stream registry</h1>
        <p>Streams are created and maintained by the authoritative university CSV. This workspace is verification only.</p>
      </header>
      {error && <div className={styles.alert}>{error}</div>}
      <div className={styles.notice}>
        <h2>Automatic source of truth</h2>
        <p>Do not edit streams here. Update the university CSV, then use Import to validate and apply the complete academic structure.</p>
      </div>
      <div className={styles.selectors}>
        <label>University<select value={universityId} onChange={(e) => setUniversityId(e.target.value)}>
          <option value="">Choose university</option>
          {universities.filter((item) => item.status === 'ACTIVE').map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select></label>
        <label>Curriculum<select value={curriculumId} onChange={(e) => setCurriculumId(e.target.value)}>
          <option value="">Choose curriculum</option>
          {visibleCurriculums.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}
        </select></label>
        <label>Search streams<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Natural, Social, NAT…" /></label>
      </div>
      <div className={styles.list}>
        <div className={styles.crudHead}><div><h2>Imported streams</h2><p>Stable stream records used by student registration.</p></div><b>{visibleStreams.length}</b></div>
        {!visibleStreams.length && <div className={styles.empty}>No streams are registered for this curriculum.</div>}
        {visibleStreams.map((item) => (
          <div className={styles.row} key={item.id}>
            <div><b>{item.code} · {item.name}</b><small>{item.status} · Stream ID #{item.id}</small></div>
            <span>Managed by university CSV</span>
          </div>
        ))}
      </div>
    </section>
  )
}