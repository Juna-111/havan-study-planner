type TelegramWebApp = {
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
  const webApp = window.Telegram?.WebApp
  if (!webApp) return

  webApp.ready?.()
  webApp.expand?.()
  webApp.setHeaderColor?.('#01017E')
  webApp.setBackgroundColor?.('#F5F6FB')
}
