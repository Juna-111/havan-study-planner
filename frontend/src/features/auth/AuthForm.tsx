'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { getAuthToken, saveAuth, type AuthResponse } from '@/lib/auth'
import { BrandedHeader } from '@/components/brand/BrandedHeader'
import { CheckIcon } from '@/components/brand/illustrations'

type Mode = 'login' | 'signup' | 'forgot'
type ForgotStep = 'email' | 'code' | 'done'

export default function AuthForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (getAuthToken()) router.replace('/student/havan')
  }, [router])

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setMessage('')
    if (next === 'forgot') setForgotStep('email')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (mode === 'forgot') {
      if (forgotStep === 'email') {
        setBusy(true)
        try {
          const response = await apiFetch<{ message: string }>('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
          })
          setMessage(response.message)
          setForgotStep('code')
        } catch (err) {
          setError(err instanceof Error ? err.message : 'We could not send the verification code. Please try again.')
        } finally {
          setBusy(false)
        }
        return
      }

      if (forgotStep === 'code') {
        setBusy(true)
        try {
          await apiFetch<{ message: string }>('/auth/verify-reset-code', {
            method: 'POST',
            body: JSON.stringify({ email, code }),
          })
          setForgotStep('done')
          setMessage('Code verified. Choose a new password below.')
        } catch (err) {
          setError(err instanceof Error ? err.message : 'That verification code is invalid or expired. Please request a new one.')
        } finally {
          setBusy(false)
        }
        return
      }

      if (password !== confirm) {
        setError('Passwords do not match.')
        return
      }

      setBusy(true)
      try {
        await apiFetch<{ message: string }>('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, code, new_password: password }),
        })
        setMode('login')
        setForgotStep('email')
        setPassword('')
        setCode('')
        setMessage('Password reset successfully. Sign in with your new password.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'We could not reset your password. Please try again.')
      } finally {
        setBusy(false)
      }
      return
    }

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match. Please re-enter them to continue.')
      return
    }

    setBusy(true)
    try {
      const response = await apiFetch<AuthResponse>(mode === 'login' ? '/auth/login' : '/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      saveAuth(response)
      router.replace(response.account.student_profile_id ? '/student/havan' : '/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not complete your sign-in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const isForgot = mode === 'forgot'
  const title = isForgot
    ? forgotStep === 'email' ? 'Reset your password.' : forgotStep === 'code' ? 'Check your email.' : 'Choose a new password.'
    : mode === 'login' ? 'Welcome back.' : 'Create your account.'
  const lead = isForgot
    ? forgotStep === 'email'
      ? 'Enter your Gmail address and Havan will send you a verification code.'
      : forgotStep === 'code'
        ? 'Enter the 6-digit verification code sent to your email.'
        : 'Your code is verified. Set a new password for your account.'
    : mode === 'login'
      ? 'Sign in to access your saved profile, plan, exams, and progress.'
      : 'Create one account so your Havan profile is available every time you return.'

  const busyLabel = isForgot
    ? forgotStep === 'email' ? 'Sending code…'
      : forgotStep === 'code' ? 'Verifying…'
        : 'Resetting password…'
    : mode === 'login' ? 'Signing you in…' : 'Creating your account…'

  return (
    <main className={`auth-shell ${busy ? 'auth-is-busy' : ''}`}>
      <section className="auth-brand-panel auth-reveal auth-reveal-1">
        <div className="auth-brand-inner">
          <div style={{padding: '0 0 16px'}}>
            <BrandedHeader eyebrow="HAVAN STUDY PLANNER" title="Plan with clarity." logoSize={84} />
          </div>
          <p>Choose what you want to study, tell Havan how much time you have, and keep control of your plan.</p>
          <div className="auth-points">
            <div className="auth-point"><CheckIcon size={18} /><span>Your profile stays connected to your study progress.</span></div>
            <div className="auth-point"><CheckIcon size={18} /><span>Return anytime and continue where you stopped.</span></div>
            <div className="auth-point"><CheckIcon size={18} /><span>Edit your academic and study preferences whenever they change.</span></div>
          </div>
        </div>
      </section>
      <section className="auth-panel auth-reveal auth-reveal-2">
        <div className="auth-card">
          <span className="eyebrow">Havan · Study Planner</span>
          <h2>{title}</h2>
          <p className="lead">{lead}</p>

          <form className="auth-form" onSubmit={submit} aria-busy={busy}>
            <label>
              Email
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>

            {isForgot && forgotStep === 'code' && (
              <label>
                Verification code
                <input inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} pattern="[0-9]{6}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" />
              </label>
            )}

            {isForgot && forgotStep === 'done' && (
              <>
                <label>
                  New password
                  <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
                </label>
                <label>
                  Confirm new password
                  <input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your new password" />
                </label>
              </>
            )}

            {!isForgot && (
              <label>
                Password
                <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              </label>
            )}

            {!isForgot && mode === 'signup' && (
              <label>
                Confirm password
                <input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your password" />
              </label>
            )}

            {error && <div className="auth-error">{error}</div>}
            {message && <div className="auth-message">{message}</div>}

            <button className="auth-submit" disabled={busy}>{busy && <span className="auth-button-pulse" aria-hidden="true"><i /><i /><i /></span>}
              {busy ? busyLabel : isForgot
                ? forgotStep === 'email' ? 'Send verification code'
                  : forgotStep === 'code' ? 'Verify code'
                    : 'Reset password'
                : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {isForgot && forgotStep === 'code' && (
            <button className="auth-link-button" type="button" onClick={() => { setForgotStep('email'); setError(''); setMessage('') }}>
              Use a different email
            </button>
          )}

          {isForgot ? (
            <div className="auth-switch">
              Remember your password? <button type="button" onClick={() => switchMode('login')}>Sign in</button>
            </div>
          ) : (
            <>
              {mode === 'login' && (
                <div className="auth-switch">
                  <button type="button" onClick={() => switchMode('forgot')}>Forgot password?</button>
                </div>
              )}
              <div className="auth-switch">
                {mode === 'login'
                  ? <>New to Havan? <button type="button" onClick={() => switchMode('signup')}>Create an account</button></>
                  : <>Already have an account? <button type="button" onClick={() => switchMode('login')}>Sign in</button></>}
              </div>
            </>
          )}

          <p className="auth-note">Your account keeps your academic profile and study plans connected across sessions. You stay in control of what you study and when.</p>
        </div>
      </section>
    </main>
  )
}
