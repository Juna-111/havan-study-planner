'use client'

import { Card } from '@/components/ui'

type Course = { id: number; code: string; name: string }

export default function CourseChoice({
  course,
  checked,
  onToggle,
}: {
  course: Course
  checked: boolean
  onToggle: (id: number, checked: boolean) => void
}) {
  return (
    <Card className={checked ? 'onboarding-course-card selected' : 'onboarding-course-card'}>
      <button
        type="button"
        className="onboarding-course-choice"
        aria-pressed={checked}
        onClick={() => onToggle(course.id, !checked)}
      >
        <span className="onboarding-course-choice-mark" aria-hidden="true">{checked ? '✓' : '+'}</span>
        <span className="onboarding-course-choice-copy">
          <strong>{course.code}</strong>
          <span>{course.name}</span>
        </span>
        <span className="onboarding-course-choice-state">{checked ? 'Selected' : 'Choose'}</span>
      </button>
    </Card>
  )
}
