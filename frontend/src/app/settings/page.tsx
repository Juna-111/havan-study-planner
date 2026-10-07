'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/layout'
import { Button, Card, Chip, ErrorState } from '@/components/ui'
import { StudentGate } from '@/features/student/StudentGate'
import { clearAuth, getSavedAccount } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { getMyStudentProfile } from '@/lib/session'
import ExamManager from '@/features/student/ExamManager'
import SettingsProfile from '@/features/student/SettingsProfile'

type Profile = { id: number; name: string; university_id: number; curriculum_id: number; stream_id: number; study_hours_per_day: number; study_days: string[] }

function PasswordCard() {
  const [currentPassword,setCurrentPassword]=useState(''); const [newPassword,setNewPassword]=useState(''); const [confirmPassword,setConfirmPassword]=useState(''); const [message,setMessage]=useState(''); const [saving,setSaving]=useState(false)
  async function changePassword(){ if(newPassword!==confirmPassword){setMessage('New passwords do not match.');return} if(newPassword.length<8){setMessage('Your new password must be at least 8 characters.');return} setSaving(true);setMessage(''); try{await apiFetch('/auth/change-password',{method:'POST',body:JSON.stringify({current_password:currentPassword,new_password:newPassword})});setCurrentPassword('');setNewPassword('');setConfirmPassword('');setMessage('Password changed successfully.')}catch(value){setMessage(value instanceof Error?value.message:'Could not change your password.')}finally{setSaving(false)} }
  return <Card padding="lg" className="settings-card"><Chip tone="info">SECURITY</Chip><h2>Change password</h2><div className="app-form"><label className="app-field">Current password<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} autoComplete="current-password"/></label><label className="app-field">New password<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password"/></label><label className="app-field">Confirm new password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password"/></label><Button disabled={saving||!currentPassword||!newPassword||!confirmPassword} loading={saving} onClick={()=>void changePassword()}>Change password</Button></div>{message&&<p className="app-meta" role="status">{message}</p>}</Card>
}

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
        <PasswordCard />
        <Button variant="danger" onClick={() => { clearAuth(); router.replace('/auth') }}>Sign out</Button>
      </div>
    </AppShell>
  )
}
