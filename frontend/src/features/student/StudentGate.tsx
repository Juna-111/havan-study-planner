'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getAuthToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { HavanLogo } from '@/components/brand/HavanLogo'

export function StudentGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace('/auth?redirect=' + encodeURIComponent(pathname))
      return
    }

    apiFetch<{ role: string; student_profile_id: number | null }>('/auth/me')
      .then((account) => {
        if (account.role !== 'STUDENT') {
          router.replace('/admin')
        } else if (!account.student_profile_id) {
          router.replace('/onboarding')
        } else {
          setOk(true)
        }
      })
      .catch(() => router.replace('/auth?redirect=' + encodeURIComponent(pathname)))
  }, [router, pathname])

  return ok ? children : (
    <main className="havan-gate-loading" aria-label="Loading Havan">
      <HavanLogo size={58} variant="light" />
      <p>Preparing your Havan space…</p>
    </main>
  )
}
