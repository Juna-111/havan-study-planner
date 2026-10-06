'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type Request = {
  id: number
  request_type: 'UNIVERSITY' | 'CURRICULUM'
  university_id?: number | null
  name: string
  code?: string | null
  version?: string | null
  academic_year?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  admin_note?: string | null
  created_at: string
}

export default function RequestManagementScreen() {
  const [requests, setRequests] = useState<Request[]>([])
  const [filter, setFilter] = useState<'ALL' | Request['status']>('PENDING')
  const [note, setNote] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      setRequests(await apiFetch<Request[]>('/academic-catalog-requests'))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load student requests.')
    }
  }

  useEffect(() => { load() }, [])

  async function review(id: number, status: 'APPROVED' | 'REJECTED') {
    setBusy(id)
    setError('')
    try {
      await apiFetch('/academic-catalog-requests/' + id, {
        method: 'PATCH',
        body: JSON.stringify({ status, admin_note: note[id]?.trim() || null }),
      })
      await load()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not review request.')
    } finally {
      setBusy(null)
    }
  }

  const visible = requests.filter((item) => filter === 'ALL' || item.status === filter)
  const pending = requests.filter((item) => item.status === 'PENDING').length

  return (
    <section>
      <header className={styles.header}>
        <span>QUALITY · D11</span>
        <h1>Student requests</h1>
        <p>Review missing university and curriculum requests before they become shared academic catalog records.</p>
      </header>
      {error && <div className={styles.alert}>{error}</div>}
      <div className={styles.stats}>
        <div><span>Pending</span><b>{pending}</b></div>
        <div><span>Total</span><b>{requests.length}</b></div>
        <div><span>Approved</span><b>{requests.filter((item) => item.status === 'APPROVED').length}</b></div>
        <div><span>Rejected</span><b>{requests.filter((item) => item.status === 'REJECTED').length}</b></div>
      </div>
      <div className={styles.tabs}>
        {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map((value) => (
          <button className={filter === value ? styles.active : ''} key={value} onClick={() => setFilter(value)}>
            {value}
          </button>
        ))}
      </div>
      <div className={styles.issueList}>
        {visible.map((item) => (
          <article className={styles.issue} key={item.id}>
            <div>
              <b>{item.request_type}</b>
              <strong>{item.name}</strong>
              <p>{item.code || item.version || 'No additional identifier supplied'}{item.academic_year ? ' · ' + item.academic_year : ''}</p>
              <small>{item.status} · {new Date(item.created_at).toLocaleDateString()}</small>
            </div>
            {item.status === 'PENDING' && (
              <div className={styles.actions}>
                <input
                  value={note[item.id] || ''}
                  onChange={(event) => setNote((old) => ({ ...old, [item.id]: event.target.value }))}
                  placeholder="Optional admin note"
                />
                <button className={styles.primary} disabled={busy === item.id} onClick={() => review(item.id, 'APPROVED')}>Approve</button>
                <button className={styles.danger} disabled={busy === item.id} onClick={() => review(item.id, 'REJECTED')}>Reject</button>
              </div>
            )}
          </article>
        ))}
        {!visible.length && <div className={styles.empty}>No requests in this filter.</div>}
      </div>
    </section>
  )
}
