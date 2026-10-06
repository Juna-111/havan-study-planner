import { describe, expect, it } from 'vitest'
import { WEEKDAY_KEYS, weekdayIndex } from '@/lib/weekdays'
import { formatMinutes } from '@/lib/format'
import { dateKey, todayLocalISO } from '@/lib/dates'

describe('weekdays', () => {
  it('uses Monday-first canonical keys', () => {
    expect(WEEKDAY_KEYS).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
    expect(weekdayIndex('sun')).toBe(6)
  })
})

describe('format helpers', () => {
  it('formats minutes consistently', () => {
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(90)).toBe('1h 30m')
  })
})

describe('Addis date helpers', () => {
  it('uses the Addis calendar date around UTC midnight', () => {
    const utc = new Date('2026-10-05T23:30:00Z')
    expect(dateKey(utc)).toBe('2026-10-06')
    expect(todayLocalISO(utc)).toBe('2026-10-06')
  })
})
