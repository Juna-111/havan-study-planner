'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'

export function StudentGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace('/auth')
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
      .catch(() => router.replace('/auth'))
  }, [router])

  return ok ? children : null
}
