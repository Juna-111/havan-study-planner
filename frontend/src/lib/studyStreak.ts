const STORAGE_PREFIX = 'havan-study-activity:'
const ACTIVITY_EVENT = 'havan:study-completed'

function addisDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function previousDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  const previous = new Date(Date.UTC(year, month - 1, day - 1))
  return [
    previous.getUTCFullYear(),
    String(previous.getUTCMonth() + 1).padStart(2, '0'),
    String(previous.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function readActivityDates(studentId: number): Set<string> {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${studentId}`)
    const dates: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(dates)) return new Set()
    return new Set(dates.filter((value): value is string => (
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    )))
  } catch {
    return new Set()
  }
}

export function getLocalStudyStreak(studentId: number, today = new Date()): number {
  if (typeof window === 'undefined') return 0
  const dates = readActivityDates(studentId)
  const todayKey = addisDateKey(today)
  let cursor = dates.has(todayKey) ? todayKey : previousDateKey(todayKey)
  let streak = 0
  while (dates.has(cursor)) {
    streak += 1
    cursor = previousDateKey(cursor)
  }
  return streak
}

export function recordLocalStudyCompletion(studentId: number) {
  if (typeof window === 'undefined') return
  const dates = readActivityDates(studentId)
  dates.add(addisDateKey())
  const retainedDates = [...dates].sort().slice(-400)
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${studentId}`, JSON.stringify(retainedDates))
  } catch {
    // The API remains authoritative when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(ACTIVITY_EVENT))
}

export const STUDY_COMPLETED_EVENT = ACTIVITY_EVENT
