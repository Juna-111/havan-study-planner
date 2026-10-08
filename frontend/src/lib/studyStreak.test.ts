import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLocalStudyStreak, recordLocalStudyCompletion } from './studyStreak'

const stored = new Map<string, string>()

function stubBrowserStorage() {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    },
    dispatchEvent: vi.fn(),
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  stored.clear()
})

describe('local study streak fallback', () => {
  it('uses the Addis calendar date when recording activity', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-08T21:30:00.000Z'))
    stubBrowserStorage()

    recordLocalStudyCompletion(7)

    expect(stored.get('havan-study-activity:7')).toBe('["2026-10-09"]')
    expect(getLocalStudyStreak(7)).toBe(1)
  })

  it('does not preserve an old maximum after the current streak expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-08T21:30:00.000Z'))
    stubBrowserStorage()
    stored.set('havan-study-activity:7', '["2026-10-01","2026-10-02"]')

    expect(getLocalStudyStreak(7)).toBe(0)
  })
})
