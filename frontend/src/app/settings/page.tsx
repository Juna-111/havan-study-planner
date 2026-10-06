'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/layout'
import { Button, Card, Chip, ErrorState } from '@/components/ui'
import { StudentGate } from '@/features/student/StudentGate'
import { clearAuth, getSavedAccount } from '@/lib/auth'
import { getMyStudentProfile } from '@/lib/session'
import ExamManager from '@/features/student/ExamManager'
import SettingsProfile from '@/features/student/SettingsProfile'

type Profile = { id: number; name: string; university_id: number; curriculum_id: number; stream_id: number; study_hours_per_day: number; study_days: string[] }

export default function Settings() {
  return <StudentGate><View /></StudentGate>
}

function View() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    getMyStudentProfile<Profile>().then(setProfile).catch((value) => setError(value instanceof Error ? value.message : 'Could not load your profile.'))
  }, [])
  return (
    <AppShell>
      <PageHeader title="Settings" description="Your account and study preferences." />
      {error && <ErrorState message={error} onRetry={() => setError('')} />}
      <div className="app-section">
        <Card padding="lg" className="settings-card">
          <Chip tone="info">ACCOUNT</Chip>
          <div className="settings-account">
            <h2>{getSavedAccount()?.email ?? 'Student account'}</h2>
            <p className="app-meta">Profile #{getSavedAccount()?.student_profile_id ?? '—'}</p>
          </div>
        </Card>
        {profile && <SettingsProfile profile={profile} onUpdate={setProfile} />}
        {profile && <ExamManager />}
        <Button variant="danger" onClick={() => { clearAuth(); router.replace('/auth') }}>Sign out</Button>
      </div>
    </AppShell>
  )
}
