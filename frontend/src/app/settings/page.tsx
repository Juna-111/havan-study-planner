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
type Profile = { id: number; name: string; university_id: number; curriculum_id: number; stream_id: number; study_hours_per_day: number; study_days: string[] }
type Opt = { id: number; name: string; code?: string }

export default function Settings() {
  return <StudentGate><View /></StudentGate>
}

function View() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [universities, setUniversities] = useState<Opt[]>([])
  const [curriculums, setCurriculums] = useState<Opt[]>([])
  const [streams, setStreams] = useState<Opt[]>([])
  const [universityId, setUniversityId] = useState('')
  const [curriculumId, setCurriculumId] = useState('')
  const [streamId, setStreamId] = useState('')
  const [hours, setHours] = useState(2)
  const [days, setDays] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getMyStudentProfile<Profile>()
      .then((value) => {
        setProfile(value)
        setName(value.name)
        setUniversityId(String(value.university_id))
        setCurriculumId(String(value.curriculum_id))
        setStreamId(String(value.stream_id))
        setHours(value.study_hours_per_day)
        setDays(value.study_days)
      })
      .catch((value) => setError(value instanceof Error ? value.message : 'Could not load your profile.'))
  }, [])

  useEffect(() => {
    apiFetch<{ items: Opt[] }>('/universities?page=1&page_size=100').then((value) => setUniversities(value.items)).catch(() => setUniversities([]))
  }, [])

  useEffect(() => {
    setCurriculums([])
    if (!universityId) return
    apiFetch<{ items: Opt[] }>('/curriculums?university_id=' + universityId + '&page=1&page_size=100').then((value) => setCurriculums(value.items)).catch(() => setCurriculums([]))
  }, [universityId])

  useEffect(() => {
    setStreams([])
    if (!curriculumId) return
    apiFetch<{ items: Opt[] }>('/streams?curriculum_id=' + curriculumId + '&page=1&page_size=100').then((value) => setStreams(value.items)).catch(() => setStreams([]))
  }, [curriculumId])

  async function save() {
    if (!profile) return
    try {
      const updated = await apiFetch<Profile>(`/students/profiles/${profile.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, university_id: Number(universityId), curriculum_id: Number(curriculumId), stream_id: Number(streamId), study_hours_per_day: hours, study_days: days }),
      })
      setProfile(updated)
      setMessage('Your profile was updated.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save your profile.')
    }
  }

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
        {profile && (
          <Card padding="lg" className="settings-card">
            <h2>Profile</h2>
            <label className="app-field">University<select value={universityId} onChange={(event) => { setUniversityId(event.target.value); setCurriculumId(''); setStreamId('') }}><option value="">Choose university</option>{universities.map((item) => <option key={item.id} value={item.id}>{item.code ? item.code + ' · ' : ''}{item.name}</option>)}</select></label>
            <label className="app-field">Curriculum<select value={curriculumId} onChange={(event) => { setCurriculumId(event.target.value); setStreamId('') }}><option value="">Choose curriculum</option>{curriculums.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="app-field">Stream<select value={streamId} onChange={(event) => setStreamId(event.target.value)}><option value="">Choose stream</option>{streams.map((item) => <option key={item.id} value={item.id}>{item.code ? item.code + ' · ' : ''}{item.name}</option>)}</select></label>
            <label className="app-field">
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <NumberStepper label="Hours per study day" value={hours} min={1} max={12} onChange={setHours} />
            <div className="app-section">
              <h3>Study days</h3>
              <div className="day-toggle-group">
                {DAYS.map((day) => (
                  <button className="day-toggle" key={day} type="button" aria-pressed={days.includes(day)} onClick={() => setDays((old) => old.includes(day) ? old.filter((item) => item !== day) : [...old, day])}>{day}</button>
                ))}
              </div>
            </div>
            <Button disabled={!universityId || !curriculumId || !streamId} onClick={save}>Save changes</Button>
            {message && <p className="app-meta">{message}</p>}
          </Card>
        )}
        <Button variant="danger" onClick={() => { clearAuth(); router.replace('/auth') }}>Sign out</Button>
      </div>
    </AppShell>
  )
}
