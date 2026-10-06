'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type Props = { onMode: (mode: 'academic' | 'curriculum' | 'streams' | 'mapping' | 'content' | 'import' | 'quality' | 'requests' | 'registry') => void }
type Page<T> = { items: T[] }
type Item = { id: number; status: string }

export default function AdminOverview({ onMode }: Props) {
  const [stats, setStats] = useState({ universities: 0, curricula: 0, streams: 0, courses: 0, mappings: 0, requests: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch<Page<Item>>('/universities?page=1&page_size=100'),
      apiFetch<Page<Item>>('/curriculums?page=1&page_size=100'),
      apiFetch<Page<Item>>('/streams?page=1&page_size=100'),
      apiFetch<Item[]>('/university-course-mappings/courses'),
      apiFetch<Item[]>('/university-course-mappings'),
      apiFetch<Array<{ status: string }>>('/academic-catalog-requests'),
    ]).then(([universities, curricula, streams, courses, mappings, requests]) => {
      setStats({
        universities: universities.items.filter((item) => item.status === 'ACTIVE').length,
        curricula: curricula.items.filter((item) => item.status === 'ACTIVE').length,
        streams: streams.items.filter((item) => item.status === 'ACTIVE').length,
        courses: courses.filter((item) => item.status === 'ACTIVE').length,
        mappings: mappings.filter((item) => item.status === 'ACTIVE').length,
        requests: requests.filter((item) => item.status === 'PENDING').length,
      })
    }).catch((value) => setError(value instanceof Error ? value.message : 'Could not load admin overview.'))
  }, [])

  const cards = [
    ['Active universities', stats.universities, 'academic'],
    ['Active curricula', stats.curricula, 'academic'],
    ['Active streams', stats.streams, 'streams'],
    ['Course Registry', stats.courses, 'registry'],
    ['Active course mappings', stats.mappings, 'mapping'],
    ['Pending requests', stats.requests, 'requests'],
  ] as const

  return (
    <section>
      <header className={styles.header}>
        <span>SYSTEM · ADMIN OVERVIEW</span>
        <h1>Havan academic workspace</h1>
        <p>One place to see whether the academic catalog is ready. Every number below opens the workspace that owns it.</p>
      </header>
      {error && <div className={styles.alert}>{error}</div>}
      <div className={styles.stats}>
        {cards.map(([label, value, mode]) => (
          <button key={label} className={styles.statButton} onClick={() => onMode(mode)}>
            <span>{label}</span><b>{value}</b><small>Open workspace →</small>
          </button>
        ))}
      </div>
      <div className={styles.health}>
        <div><b>Catalog control</b><span>Keep universities, curricula, streams and mappings active only when their dependencies are ready.</span></div>
        <button className={styles.primary} onClick={() => onMode('quality')}>Review data quality →</button>
      </div>
    </section>
  )
}
