'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { AdminMode } from './AdminShell'
import styles from './admin.module.css'

type Props = { onMode: (mode: AdminMode) => void }
type Page<T> = { items: T[] }
type Item = { id: number; status: string }

export default function AdminOverview({ onMode }: Props) {
  const [stats, setStats] = useState({ universities: 0, streams: 0, courses: 0, mappings: 0, requests: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch<Page<Item>>('/universities?page=1&page_size=100'),
      apiFetch<Page<Item>>('/streams?page=1&page_size=100'),
      apiFetch<Page<Item>>('/courses?page=1&page_size=100'),
      apiFetch<Item[]>('/university-course-offerings'),
      apiFetch<Array<{ status: string }>>('/academic-catalog-requests'),
    ]).then(([universities, streams, courses, mappings, requests]) => {
      setStats({
        universities: universities.items.filter((item) => item.status === 'ACTIVE').length,
        streams: streams.items.filter((item) => item.status === 'ACTIVE').length,
        courses: courses.items.filter((item) => item.status === 'ACTIVE').length,
        mappings: mappings.filter((item) => item.status === 'ACTIVE').length,
        requests: requests.filter((item) => item.status === 'PENDING').length,
      })
    }).catch((value) => setError(value instanceof Error ? value.message : 'Could not load admin overview.'))
  }, [])

  const cards = [
    ['Active universities', stats.universities, 'catalog'],
    ['Active streams', stats.streams, 'catalog'],
    ['Course Registry', stats.courses, 'content'],
    ['Active course offerings', stats.mappings, 'catalog'],
    ['Pending requests', stats.requests, 'review'],
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
        <div><b>Catalog control</b><span>Keep universities, streams and mappings ready for student selection.</span></div>
        <button className={styles.primary} onClick={() => onMode('review')}>Review requests and data quality →</button>
      </div>
    </section>
  )
}
