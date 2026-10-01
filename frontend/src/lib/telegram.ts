import type { AppIdentity } from './session'

type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

type TelegramWebApp = {
  initDataUnsafe?: { user?: TelegramUser }
  ready?: () => void
  expand?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function initialiseTelegram() {
  if (typeof window === 'undefined') return

  const webApp = window.Telegram?.WebApp
  if (!webApp) return

  webApp.ready?.()
  webApp.expand?.()
  webApp.setHeaderColor?.('#01017E')
  webApp.setBackgroundColor?.('#F5F6FB')
}

export function getTelegramIdentity(): AppIdentity | null {
  if (typeof window === 'undefined') return null

  const user = window.Telegram?.WebApp?.initDataUnsafe?.user
  if (!user || !Number.isSafeInteger(user.id) || !user.first_name.trim()) return null

  return {
    id: `telegram-${user.id}`,
    name: [user.first_name, user.last_name].filter(Boolean).join(' '),
    username: user.username,
    source: 'telegram',
  }
}
