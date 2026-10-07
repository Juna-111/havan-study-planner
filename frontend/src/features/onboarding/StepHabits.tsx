'use client'

import { Card, NumberStepper } from '@/components/ui'

const DAYS = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
] as const

interface StepHabitsProps {
  days: string[]
  hours: number
  onDays: (days: string[]) => void
  onHours: (hours: number) => void
}

export default function StepHabits({ days, hours, onDays, onHours }: StepHabitsProps) {
  const toggleDay = (key: string) => {
    onDays(days.includes(key) ? days.filter((day) => day !== key) : [...days, key])
  }

  return (
    <Card className="onboarding-habits-card">
      <div className="onboarding-section-heading">
        <span className="app-eyebrow">YOUR STUDY HABITS</span>
        <h2>When do you normally study?</h2>
        <p className="app-copy">Tell Havan which days are available and how much time you normally have on a study day. You can still choose a different plan window later.</p>
      </div>

      <div className="onboarding-habits-block">
        <div className="onboarding-habits-label">
          <strong>Study days</strong>
          <span>{days.length} selected</span>
        </div>
        <div className="onboarding-days" role="group" aria-label="Study days">
          {DAYS.map(([key, label]) => (
            <button
              className="onboarding-day"
              key={key}
              type="button"
              aria-pressed={days.includes(key)}
              onClick={() => toggleDay(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {days.length === 0 && <p className="onboarding-field-hint" role="alert">Choose at least one study day to continue.</p>}
      </div>

      <div className="onboarding-hours-block">
        <NumberStepper
          label="Hours per study day"
          value={hours}
          min={1}
          max={12}
          onChange={onHours}
        />
        <p className="onboarding-field-hint">This is your normal daily capacity, not a requirement to study every available minute.</p>
      </div>
    </Card>
  )
}
