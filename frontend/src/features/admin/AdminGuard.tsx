'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

type Account = { role?: string }

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    apiFetch<Account>('/auth/me')
      .then((account) => setState(account.role === 'ADMIN' ? 'allowed' : 'denied'))
      .catch(() => setState('denied'))
  }, [])

  if (state === 'loading') {
    return <main className="adminLoading">Loading Havan admin…</main>
  }

  if (state === 'denied') {
    return (
      <main className="adminDenied">
        <div>
          <span>HAVAN</span>
          <h1>Not allowed</h1>
          <p>This area is only for Havan administrators.</p>
          <a href="/home">Go to Havan home</a>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
