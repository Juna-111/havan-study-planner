export const WEEKDAYS = [
  { key: 'mon', label: 'Mon', full: 'Monday' },
  { key: 'tue', label: 'Tue', full: 'Tuesday' },
  { key: 'wed', label: 'Wed', full: 'Wednesday' },
  { key: 'thu', label: 'Thu', full: 'Thursday' },
  { key: 'fri', label: 'Fri', full: 'Friday' },
  { key: 'sat', label: 'Sat', full: 'Saturday' },
  { key: 'sun', label: 'Sun', full: 'Sunday' },
] as const

export type Weekday = (typeof WEEKDAYS)[number]['key']
export const WEEKDAY_KEYS = WEEKDAYS.map((day) => day.key) as Weekday[]

export function weekdayIndex(day: Weekday): number {
  return WEEKDAY_KEYS.indexOf(day)
}
