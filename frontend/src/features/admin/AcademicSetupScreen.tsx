'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type University = { id: number; name: string; code: string; status: string }
type Stream = { id: number; university_id: number; name: string; code: string; status: string }

export default function AcademicSetupScreen({ onImport }: { onImport?: () => void }) {
  const [universities, setUniversities] = useState<University[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [universityId, setUniversityId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch<{ items: University[] }>('/universities?page=1&page_size=100'),
      apiFetch<{ items: Stream[] }>('/streams?page=1&page_size=100'),
    ]).then(([universityResult, streamResult]) => {
      setUniversities(universityResult.items)
      setStreams(streamResult.items)
      const firstActive = universityResult.items.find((item) => item.status === 'ACTIVE')
      if (firstActive) setUniversityId(String(firstActive.id))
    }).catch((value) => setError(value instanceof Error ? value.message : 'Could not load academic catalog.'))
  }, [])

  const selectedUniversity = universities.find((item) => String(item.id) === universityId)
  const visibleStreams = streams.filter((item) => String(item.university_id) === universityId)

  return (
    <section>
      <header className={styles.header}>
        <span>SETUP · ACADEMIC CATALOG</span>
        <h1>Academic catalog</h1>
        <p>Universities contain streams. Course offerings map directly to each university stream.</p>
      </header>
      {error && <div className={styles.alert}>{error}</div>}
      <div className={styles.notice}>
        <h2>Update the catalog</h2>
        <p>Upload a university CSV to add or update universities, streams, and course offerings.</p>
        {onImport && <button className={styles.primary} onClick={onImport}>Update university CSV</button>}
      </div>
      <div className={styles.selectors}>
        <label>University<select value={universityId} onChange={(event) => setUniversityId(event.target.value)}>
          <option value="">Choose university</option>
          {universities.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select></label>
      </div>
      <div className={styles.stats}>
        <div><span>Universities</span><b>{universities.length}</b></div>
        <div><span>Streams</span><b>{visibleStreams.length}</b></div>
        <div><span>Active streams</span><b>{visibleStreams.filter((item) => item.status === 'ACTIVE').length}</b></div>
        <div><span>University status</span><b>{selectedUniversity?.status ?? '—'}</b></div>
      </div>
      <div className={styles.list}>
        <div className={styles.crudHead}><div><h2>{selectedUniversity?.name ?? 'Select a university'}</h2><p>Streams and offerings available to student registration.</p></div></div>
        {visibleStreams.map((item) => <div className={styles.row} key={item.id}><div><b>{item.code} · {item.name}</b><small>{item.status} · Stream ID #{item.id}</small></div><span>University stream</span></div>)}
        {!visibleStreams.length && <div className={styles.empty}>No streams are registered for this university.</div>}
      </div>
    </section>
  )
}
