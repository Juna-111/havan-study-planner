import { describe, expect, it } from 'vitest'
import {
  buildPlan,
  getCatalogCourses,
  getPrepDaysForUniversity,
  getRecommendedMode,
  getNextAssessment,
  type Assessment,
  type StudentProfile,
} from './plan'

const baseProfile: StudentProfile = {
  university: '',
  universityId: '',
  stream: 'natural',
  courses: [
    { id: 'c1', name: 'Mathematics', topic: 'Chapter 3: Functions' },
    { id: 'c2', name: 'Physics', topic: 'Chapter 2: Motion' },
  ],
  assessments: [],
  studyDays: [1, 3, 5],
  studyHours: 2,
}

const inDays = (n: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + n)
  return date.toISOString().slice(0, 10)
}

describe('catalog lookups', () => {
  it('returns real freshman courses for AAU natural', () => {
    const courses = getCatalogCourses('aau', 'natural')
    expect(courses.length).toBeGreaterThan(3)
    expect(courses.join(' ').toLowerCase()).toContain('math')
  })

  it('falls back across tracks for universities with data', () => {
    const courses = getCatalogCourses('bahir_dar', 'pre_engineering')
    expect(Array.isArray(courses)).toBe(true)
  })

  it('returns [] for unlisted universities', () => {
    expect(getCatalogCourses('', 'natural')).toEqual([])
    expect(getCatalogCourses('not-listed', 'natural')).toEqual([])
    expect(getCatalogCourses('20_gambella', 'natural')).toEqual([])
  })
})

describe('assessment-driven mode', () => {
  it('exam mode when the nearest assessment is within 14 days', () => {
    const profile: StudentProfile = {
      ...baseProfile,
      assessments: [{ courseId: 'c1', name: 'Math midterm', date: inDays(5) } as Assessment],
    }
    expect(getRecommendedMode(profile, [])).toBe('exam')
    expect(getNextAssessment(profile)?.name).toBe('Math midterm')
  })

  it('prefers the soonest of midterm and final', () => {
    const profile: StudentProfile = {
      ...baseProfile,
      assessments: [
        { courseId: 'c1', name: 'Final', date: inDays(30) },
        { courseId: 'c2', name: 'Midterm', date: inDays(3) },
      ],
    }
    expect(getNextAssessment(profile)?.name).toBe('Midterm')
  })

  it('catch-up mode when the plan has skipped items', () => {
    const profile = baseProfile
    const plan = buildPlan(profile).map((item, index) =>
      index === 0 ? { ...item, status: 'skipped' as const } : item,
    )
    expect(getRecommendedMode(profile, plan)).toBe('catch-up')
  })

  it('keep-up mode otherwise', () => {
    expect(getRecommendedMode(baseProfile, [])).toBe('keep-up')
  })
})

describe('prep program filtering', () => {
  it('includes all-university days for everyone', () => {
    const days = getPrepDaysForUniversity('AAU', false)
    expect(days.some((d) => d.allUniversities)).toBe(true)
    // health-track days excluded for non-health tracks
    expect(days.some((d) => [26, 27, 28].includes(d.day))).toBe(false)
  })

  it('includes health days only for health tracks', () => {
    const days = getPrepDaysForUniversity('AAU', true)
    expect(days.some((d) => [26, 27, 28].includes(d.day))).toBe(true)
  })

  it('always keeps review days', () => {
    const days = getPrepDaysForUniversity('AAU', false)
    expect(days.filter((d) => d.title.startsWith('Review')).length).toBeGreaterThan(3)
  })
})

describe('plan generation', () => {
  it('uses catalog courses and honors study days', () => {
    const profile: StudentProfile = {
      ...baseProfile,
      universityId: 'aau',
      courses: getCatalogCourses('aau', 'natural').slice(0, 4).map((name, i) => ({ id: `c${i}`, name, topic: `Topic ${i + 1}` })),
    }
    const plan = buildPlan(profile)
    expect(plan.length).toBeGreaterThan(0)
    for (const item of plan) expect(profile.studyDays).toContain(item.day)
    expect(plan.every((item) => item.topic.length > 0)).toBe(true)
  })
})
