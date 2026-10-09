'use client'

import { useEffect, useState } from 'react'
import { Button, Card } from '@/components/ui'
import { apiFetch } from '@/lib/api'

type NotificationStatus = { supported: boolean; public_key: string; enabled: boolean }

function decodeKey(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

export default function NotificationSettings() {
  const [status, setStatus] = useState<NotificationStatus | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function refresh() {
    const result = await apiFetch<NotificationStatus>('/students/me/notifications')
    setStatus(result)
    if ('Notification' in window) setPermission(Notification.permission)
  }

  useEffect(() => { void refresh().catch(() => setMessage('Could not load notification settings.')) }, [])

  async function enable() {
    if (!status?.supported || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    setBusy(true); setMessage('')
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') { setMessage('Allow notifications in your browser settings, then try again.'); return }
      const registration = await navigator.serviceWorker.register('/sw.js')
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(status.public_key) as BufferSource })
      await apiFetch<void>('/students/me/notifications/subscription', { method: 'POST', body: JSON.stringify(subscription.toJSON()) })
      await refresh()
      setMessage('Notifications are on for upcoming exams and today’s study plan.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not enable notifications.')
    } finally { setBusy(false) }
  }

  async function disable() {
    setBusy(true); setMessage('')
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      await subscription?.unsubscribe()
      await apiFetch<void>('/students/me/notifications/subscription', { method: 'DELETE' })
      await refresh()
      setMessage('Notifications are off.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not turn notifications off.') }
    finally { setBusy(false) }
  }

  const browserSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return <Card padding="lg" className="settings-card">
    <h2>Study reminders</h2>
    <p className="app-meta">Get a reminder for exams 7 days before, the day before, and on exam day, plus your study tasks for today. Your browser must allow notifications; Android works best when Havan is installed or added to your home screen.</p>
    {!browserSupported && <p role="status">This browser does not support background notifications.</p>}
    {status && !status.supported && <p role="status">Push reminders are not configured on the Havan server yet.</p>}
    {permission === 'denied' && <p role="status">Notifications are blocked by your browser. Allow them in site settings, then return here.</p>}
    {status?.supported && browserSupported && (status.enabled
      ? <Button variant="secondary" disabled={busy} onClick={() => void disable()}>{busy ? 'Updating…' : 'Turn reminders off'}</Button>
      : <Button variant="accent" disabled={busy || permission === 'denied'} onClick={() => void enable()}>{busy ? 'Enabling…' : 'Enable study reminders'}</Button>)}
    {message && <p className="app-meta" role="status">{message}</p>}
  </Card>
}
