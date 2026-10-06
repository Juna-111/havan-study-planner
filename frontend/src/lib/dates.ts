export const todayLocalISO = (now = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(now)

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + days))
  return value.toISOString().slice(0, 10)
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${iso}T12:00:00+03:00`))
}

export function formatRange(start: string, end: string): string {
  return `${formatDay(start)} - ${formatDay(end)}`
}

export function daysUntil(target: string, now = todayLocalISO()): number {
  const [ty, tm, td] = target.split('-').map(Number)
  const [ny, nm, nd] = now.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(ny, nm - 1, nd)) / 86_400_000)
}

// Compatibility for older callers during migration.
export const todayAddis = (now = new Date()) => new Date(`${todayLocalISO(now)}T00:00:00+03:00`)
export const dateKey = (date: Date) => todayLocalISO(date)
