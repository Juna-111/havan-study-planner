import { createContext } from 'react'

export type StoredFocusSession = {
  sessionId: string
  taskId: number
  taskLabel: string
  minutes: number
  remainingSeconds: number
  endsAt: number | null
  running: boolean
  completed: boolean
}

export type FocusSessionContextValue = {
  session: StoredFocusSession | null
  remainingSeconds: number
  notificationPermission: NotificationPermission | 'unsupported'
  start: (taskId: number, taskLabel: string, minutes: number) => void
  pause: () => void
  resume: () => void
  adjust: (deltaMinutes: number) => void
  clear: () => void
  enableNotifications: () => Promise<void>
}

export const FocusSessionContext = createContext<FocusSessionContextValue | null>(null)
