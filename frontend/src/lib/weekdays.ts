export const WEEKDAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
] as const

export type Weekday = (typeof WEEKDAYS)[number]['key']
export const WEEKDAY_KEYS = WEEKDAYS.map((day) => day.key) as Weekday[]

export function weekdayIndex(day: Weekday): number {
  return WEEKDAY_KEYS.indexOf(day)
}
