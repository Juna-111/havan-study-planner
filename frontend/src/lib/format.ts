export function minutesLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  if (safe < 60) return `${safe} min`
  const hours = Math.floor(safe / 60)
  const remainder = safe % 60
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`
}

export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    ...options,
  }).format(typeof value === 'string' ? new Date(value) : value)
}
