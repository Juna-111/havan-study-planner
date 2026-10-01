'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { getAuthToken, saveAuth, type AuthResponse } from '@/lib/auth'
import './auth.css'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (getAuthToken()) router.replace('/student')
  }, [router])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const response = await apiFetch<AuthResponse>(mode === 'login' ? '/auth/login' : '/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      saveAuth(response)
      router.replace(response.account.student_profile_id ? '/student' : '/student?setup=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel">
        <div className="auth-brand-inner">
          <span className="auth-mark">H</span>
          <h1>Plan with clarity.</h1>
          <p>Havan turns your academic position, workload, confidence, exams, and available time into a study plan you can actually control.</p>
          <div className="auth-points">
            <div className="auth-point"><b>✓</b><span>Your profile stays connected to your study progress.</span></div>
            <div className="auth-point"><b>✓</b><span>Return anytime and continue where you stopped.</span></div>
            <div className="auth-point"><b>✓</b><span>Edit your academic and study preferences whenever they change.</span></div>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">HAVAN STUDY PLANNER</span>
          <h2>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h2>
          <p className="lead">{mode === 'login' ? 'Sign in to access your saved profile, plan, exams, and progress.' : 'Create one account so your Havan profile is available every time you return.'}</p>
          <form className="auth-form" onSubmit={submit}>
            <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
            {mode === 'signup' && <label>Confirm password<input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your password" /></label>}
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>
          <div className="auth-switch">
            {mode === 'login' ? <>New to Havan? <button type="button" onClick={() => { setMode('signup'); setError('') }}>Create an account</button></> : <>Already have an account? <button type="button" onClick={() => { setMode('login'); setError('') }}>Sign in</button></>}
          </div>
          <p className="auth-note">Your academic profile is separate from your authentication credentials. Havan stores the profile ID with your account so your work can be recovered across sessions.</p>
        </div>
      </section>
    </main>
  )
}
