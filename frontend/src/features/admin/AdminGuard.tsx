'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type Account = { role?: string }

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    apiFetch<Account>('/auth/me')
      .then((account) => setState(account.role === 'ADMIN' ? 'allowed' : 'denied'))
      .catch(() => setState('denied'))
  }, [])

  if (state === 'loading') {
    return <main className={styles.adminLoading}>Loading Havan admin…</main>
  }

  if (state === 'denied') {
    return (
      <main className={styles.adminDenied}>
        <div className={styles.adminDeniedCard}>
          <span className={styles.adminDeniedBadge}>HAVAN</span>
          <h1 className={styles.adminDeniedTitle}>Not allowed</h1>
          <p className={styles.adminDeniedText}>This area is only for Havan administrators.</p>
          <a href="/home" className={styles.adminDeniedLink}>Go to Havan home</a>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
