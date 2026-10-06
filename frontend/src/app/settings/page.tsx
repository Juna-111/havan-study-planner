'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/layout'
import { Button, Card, Chip, ErrorState, NumberStepper } from '@/components/ui'
import { StudentGate } from '@/features/student/StudentGate'
import { apiFetch } from '@/lib/api'
import { clearAuth, getSavedAccount } from '@/lib/auth'
import { getMyStudentProfile } from '@/lib/session'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type Profile = { id: number; name: string; study_hours_per_day: number; study_days: string[] }

export default function Settings() {
  return <StudentGate><View /></StudentGate>
}

function View() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [hours, setHours] = useState(2)
  const [days, setDays] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getMyStudentProfile<Profile>().then((value) => {
      setProfile(value)
      setName(value.name)
      setHours(value.study_hours_per_day)
      setDays(value.study_days)
    }).catch((value) => setError(value instanceof Error ? value.message : 'Could not load your profile.'))
  }, [])

  async function save() {
    if (!profile) return
    try {
      const updated = await apiFetch<Profile>(`/students/profiles/${profile.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, study_hours_per_day: hours, study_days: days }),
      })
      setProfile(updated)
      setMessage('Your profile was updated.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save your profile.')
    }
  }

  return <AppShell>
    <PageHeader title="Settings" description="Your account and study preferences." />
    {error && <ErrorState message={error} onRetry={() => setError('')} />}
    <div className="stack">
      <Card><Chip tone="info">ACCOUNT</Chip><h2>{getSavedAccount()?.email ?? 'Student account'}</h2><p>Profile #{getSavedAccount()?.student_profile_id ?? '—'}</p></Card>
      {profile && <Card><h2>Profile</h2><label className="field">Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><NumberStepper label="Hours per study day" value={hours} min={1} max={12} onChange={setHours} /><h3>Study days</h3><div className="row">{DAYS.map((day) => <button key={day} type="button" aria-pressed={days.includes(day)} onClick={() => setDays((old) => old.includes(day) ? old.filter((item) => item !== day) : [...old, day])}>{day}</button>)}</div><Button onClick={save}>Save changes</Button>{message && <p>{message}</p>}</Card>}
      <Button variant="danger" onClick={() => { clearAuth(); router.replace('/auth') }}>Sign out</Button>
    </div>
  </AppShell>
}
