'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type Issue = {
  severity: 'error' | 'warning' | 'info'
  entity_type: string
  entity_id: number
  title: string
  message: string
}

type Quality = {
  summary: {
    total_records: number
    issues: number
    errors: number
    warnings: number
    info: number
    active_curriculums: number
  }
  counts: Record<string, number>
  readiness: {
    status: 'ready' | 'warning' | 'error'
    active_course_mappings: number
  }
  issues: Issue[]
}

export default function QualityScreen() {
  const [data, setData] = useState<Quality | null>(null)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const load = () => {
    setError('')
    setChecking(true)
    apiFetch<Quality>('/academic-quality')
      .then(setData)
      .catch((value) =>
        setError(
          value instanceof Error
            ? value.message
            : 'Could not load quality checks.',
        ),
      )
      .finally(() => setChecking(false))
  }

  useEffect(load, [])

  const issues = useMemo(
    () => data?.issues.filter((item) => filter === 'all' || item.severity === filter) || [],
    [data, filter],
  )

  return (
    <section>
      <header className={styles.header}>
        <span>QUALITY</span>
        <h1>Academic quality</h1>
        <p>Check the data that feeds the Havan planner before it reaches students.</p>
        <button className={styles.primary} disabled={checking} onClick={load}>
          {checking ? 'Checking…' : 'Recheck data'}
        </button>
      </header>

      {error && <div className={styles.alert}>{error}</div>}

      {!data && !error ? (
        <div className={styles.empty}>Running checks…</div>
      ) : data ? (
        <>
          <div className={styles.health}>
            <b>
              {data.summary.errors
                ? 'Action needed'
                : data.summary.warnings
                  ? 'Review recommended'
                  : 'Academic data is clean'}
            </b>
            <span>
              {data.summary.issues} issues · {data.readiness.active_course_mappings}{' '}
              active course mappings
            </span>
          </div>

          <div className={styles.stats}>
            {[
              ['Errors', data.summary.errors],
              ['Warnings', data.summary.warnings],
              ['Info', data.summary.info],
              ['Records', data.summary.total_records],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>

          <div className={styles.tabs}>
            {['all', 'error', 'warning', 'info'].map((value) => (
              <button
                className={filter === value ? styles.active : ''}
                key={value}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>

          <div className={styles.issueList}>
            {issues.map((item, index) => (
              <article className={styles.issue} key={index}>
                <b>{item.severity}</b>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <small>
                    {item.entity_type} #{item.entity_id}
                  </small>
                </div>
              </article>
            ))}
            {!issues.length && (
              <div className={styles.empty}>No issues in this filter.</div>
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}
