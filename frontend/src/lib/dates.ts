const ADDIS_OFFSET_MINUTES = 3 * 60

export function todayAddis(now = new Date()): Date {
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000
  return new Date(utc + ADDIS_OFFSET_MINUTES * 60_000)
}

export function dateKey(date: Date): string {
  const addis = todayAddis(date)
  return addis.toISOString().slice(0, 10)
}
