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
    onDays(
      days.includes(key)
        ? days.filter((day) => day !== key)
        : [...days, key]
    )
  }

  return (
    <Card>
      <h2>When do you normally study?</h2>
      <p>
        Choose the days Havan may schedule. Sunday is a normal study day, not a
        special case invented by calendars.
      </p>

      <div className="row">
        {DAYS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={days.includes(key)}
            onClick={() => toggleDay(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <NumberStepper
        label="Hours per study day"
        value={hours}
        min={1}
        max={12}
        onChange={onHours}
      />
    </Card>
  )
}
