'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { FocusSessionContext, type FocusSessionContextValue, type StoredFocusSession } from './focusSessionContext'
import { apiFetch } from '@/lib/api'

const STORAGE_KEY = 'havan-focus-session-v1'

function loadSession(): StoredFocusSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as StoredFocusSession
    if (!session.taskId || !Number.isFinite(session.minutes)) return null
    if (session.running && session.endsAt !== null) {
      const remainingSeconds = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000))
      return { ...session, remainingSeconds, endsAt: remainingSeconds ? session.endsAt : null, running: remainingSeconds > 0, completed: remainingSeconds === 0 }
    }
    return session
  } catch {
    return null
  }
}

export function FocusSessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [session, setSession] = useState<StoredFocusSession | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')

  useEffect(() => {
    setSession(loadSession())
    if ('Notification' in window) setNotificationPermission(Notification.permission)
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!session) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }, [session, hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (!session) return
    if (session?.completed) return
    if (!session?.running || !session.endsAt) {
      void apiFetch<void>('/students/me/notifications/focus-session', { method: 'DELETE' }).catch(() => undefined)
      return
    }
    void apiFetch<void>('/students/me/notifications/focus-session', {
      method: 'POST',
      body: JSON.stringify({
        session_id: session.sessionId,
        task_id: session.taskId,
        task_label: session.taskLabel,
        due_at: new Date(session.endsAt).toISOString(),
      }),
    }).catch(() => undefined)
  }, [session?.sessionId, session?.taskId, session?.taskLabel, session?.endsAt, session?.running, session?.completed, hydrated])

  useEffect(() => {
    if (!session?.running || session.endsAt === null) return
    const updateRemaining = () => {
      const remainingSeconds = Math.max(0, Math.ceil((session.endsAt! - Date.now()) / 1000))
      setSession((current) => {
        if (!current || !current.running || current.taskId !== session.taskId) return current
        if (remainingSeconds === 0) return { ...current, running: false, completed: true, endsAt: null, remainingSeconds: 0 }
        return current.remainingSeconds === remainingSeconds ? current : { ...current, remainingSeconds }
      })
    }
    updateRemaining()
    const timer = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(timer)
  }, [session?.running, session?.endsAt, session?.taskId])

  useEffect(() => {
    if (!session?.completed || notificationPermission !== 'granted') return
    const sentKey = `${STORAGE_KEY}:notified:${session.sessionId}`
    if (localStorage.getItem(sentKey)) return
    const options = {
        body: `${session.taskLabel} is ready for a quick progress check-in.`,
        tag: `focus:${session.sessionId}`,
    }
    const markSent = () => localStorage.setItem(sentKey, '1')
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready
        .then((registration) => registration.showNotification('Focus session complete', options))
        .then(markSent)
        .catch(() => {
          try {
            new Notification('Focus session complete', options)
            markSent()
          } catch {
            // Permission or platform support can change while a session is running.
          }
        })
    } else {
      try {
        new Notification('Focus session complete', options)
        markSent()
      } catch {
        // Permission or platform support can change while a session is running.
      }
    }
  }, [session, notificationPermission])

  const start = useCallback((taskId: number, taskLabel: string, minutes: number) => {
    const safeMinutes = Math.max(5, Math.min(120, Math.floor(minutes)))
    setSession({
      sessionId: `${Date.now()}-${taskId}`,
      taskId,
      taskLabel,
      minutes: safeMinutes,
      remainingSeconds: safeMinutes * 60,
      endsAt: Date.now() + safeMinutes * 60_000,
      running: true,
      completed: false,
    })
  }, [])

  const pause = useCallback(() => setSession((current) => {
    if (!current?.running || current.endsAt === null) return current
    const remainingSeconds = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000))
    return { ...current, remainingSeconds, endsAt: null, running: false, completed: remainingSeconds === 0 }
  }), [])

  const resume = useCallback(() => setSession((current) => {
    if (!current || current.running || current.completed || current.remainingSeconds <= 0) return current
    return { ...current, endsAt: Date.now() + current.remainingSeconds * 1000, running: true }
  }), [])

  const adjust = useCallback((deltaMinutes: number) => setSession((current) => {
    if (!current || current.completed) return current
    const minutes = Math.max(5, Math.min(120, current.minutes + deltaMinutes))
    const deltaSeconds = (minutes - current.minutes) * 60
    const remainingSeconds = Math.max(0, current.remainingSeconds + deltaSeconds)
    return {
      ...current,
      minutes,
      remainingSeconds,
      endsAt: current.running ? Date.now() + remainingSeconds * 1000 : null,
      running: current.running && remainingSeconds > 0,
      completed: remainingSeconds === 0,
    }
  }), [])

  const clear = useCallback(() => {
    void apiFetch<void>('/students/me/notifications/focus-session', { method: 'DELETE' }).catch(() => undefined)
    setSession(null)
  }, [])
  const enableNotifications = useCallback(async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported')
      return
    }
    setNotificationPermission(await Notification.requestPermission())
  }, [])

  const value = useMemo<FocusSessionContextValue>(() => ({
    session,
    remainingSeconds: session?.remainingSeconds ?? 0,
    notificationPermission,
    start,
    pause,
    resume,
    adjust,
    clear,
    enableNotifications,
  }), [session, notificationPermission, start, pause, resume, adjust, clear, enableNotifications])

  const showDock = session && pathname !== '/plan'
  const clock = `${String(Math.floor((session?.remainingSeconds ?? 0) / 60)).padStart(2, '0')}:${String((session?.remainingSeconds ?? 0) % 60).padStart(2, '0')}`

  return <FocusSessionContext.Provider value={value}>
    {children}
    {showDock && <aside className="havan-focus-dock" aria-live="polite">
      <div><span>{session.completed ? 'FOCUS COMPLETE' : session.running ? 'FOCUS SESSION' : 'FOCUS PAUSED'}</span><strong>{session.taskLabel}</strong><small>{session.completed ? 'Return to your plan to save your study progress.' : session.running ? 'Your timer stays active as you move around Havan.' : 'Resume when you are ready.'}</small></div>
      <strong className="havan-focus-dock-clock">{clock}</strong>
      {!session.completed && <button type="button" onClick={session.running ? pause : resume}>{session.running ? 'Pause' : 'Resume'}</button>}
      <a href="/plan">{session.completed ? 'Review session' : 'Open plan'}</a>
    </aside>}
  </FocusSessionContext.Provider>
}
