'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, ErrorState } from '@/components/ui'
import { StepAcademic } from '@/features/onboarding'
import StepHabits from '@/features/onboarding/StepHabits'
import StepExams from '@/features/onboarding/StepExams'
import { apiFetch } from '@/lib/api'
import { getAuthToken, saveAuth } from '@/lib/auth'

export default function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [university, setUniversity] = useState('')
  const [curriculum, setCurriculum] = useState('')
  const [stream, setStream] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [starts, setStarts] = useState<Record<number, { chapter?: number; topic?: number }>>({})
  const [days, setDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri'])
  const [hours, setHours] = useState(2)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!getAuthToken()) router.replace('/auth')
  }, [router])

  const validAcademic = Boolean(name.trim() && university && curriculum && stream && selected.size)
  const canNext = step === 0 ? validAcademic : step === 1 ? days.length > 0 : true
  const stepLabels = ['Academic', 'Habits', 'Exams'] as const
  const selectedCount = selected.size

  function handleUniversity(value: string) {
    setUniversity(value)
    setCurriculum('')
    setStream('')
    setSelected(new Set())
    setStarts({})
  }

  function handleCurriculum(value: string) {
    setCurriculum(value)
    setStream('')
    setSelected(new Set())
    setStarts({})
  }

  function handleStream(value: string) {
    setStream(value)
    setSelected(new Set())
    setStarts({})
  }

  function handleStart(courseId: number, value: { chapter?: number; topic?: number }) {
    setStarts((old) => ({ ...old, [courseId]: value }))
  }

  async function finish() {
    if (saving) return
    setError('')
    setSaving(true)
    try {
      await apiFetch('/students/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          university_id: Number(university),
          curriculum_id: Number(curriculum),
          stream_id: Number(stream),
          study_hours_per_day: hours,
          study_days: days,
          courses: Array.from(selected).map((courseId) => {
            const start = starts[courseId]
            return {
              course_id: courseId,
              confidence: 3,
              starting_chapter_id: start?.chapter,
              starting_topic_id: start?.topic,
            }
          }),
        }),
      })

      const account = await apiFetch<{ id: number; email: string; role: 'STUDENT' | 'ADMIN'; student_profile_id: number | null }>('/auth/me')
      const token = getAuthToken()
      if (token) saveAuth({ access_token: token, token_type: 'bearer', account })
      router.replace('/home')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save your academic setup.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="onboarding-shell onboarding-journey">
      <div className="onboarding-brand-row">
        <span className="onboarding-brand">HAVAN ACADEMY</span>
        <span className="onboarding-step-count">Step {step + 1} of 3</span>
      </div>
      <div className="onboarding-hero havan-motion-enter"><span className="onboarding-hero-kicker">YOUR HAVAN JOURNEY</span><h1>Build your Havan study journey</h1>
      <p className="onboarding-intro">Set your academic context, choose the courses you want to work with, and tell Havan when you normally study.</p><div className="onboarding-hero-line" aria-hidden="true"><span /></div></div>
      <div className="onboarding-progress" aria-label="Onboarding progress">
        {stepLabels.map((label, index) => (
          <button
            key={label}
            type="button"
            className={index === step ? 'onboarding-progress-step active' : index < step ? 'onboarding-progress-step complete' : 'onboarding-progress-step'}
            onClick={() => index <= step && setStep(index)}
            disabled={index > step}
            aria-current={index === step ? 'step' : undefined}
          >
            <span>{index + 1}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </div>
      {error && <ErrorState message={error} onRetry={() => setError('')} />}
      {step === 0 && (
        <StepAcademic
          name={name}
          university={university}
          curriculum={curriculum}
          stream={stream}
          selected={selected}
          starts={starts}
          onName={setName}
          onUniversity={handleUniversity}
          onCurriculum={handleCurriculum}
          onStream={handleStream}
          onToggleCourse={(id, checked) =>
            setSelected((old) => {
              const next = new Set(old)
              checked ? next.add(id) : next.delete(id)
              if (!checked) {
                setStarts((current) => {
                  const copy = { ...current }
                  delete copy[id]
                  return copy
                })
              }
              return next
            })
          }
          onStart={handleStart}
        />
      )}
      {step === 1 && <div className="onboarding-step-panel havan-motion-enter" key="habits"><StepHabits days={days} hours={hours} onDays={setDays} onHours={setHours} /></div>}
      {step === 2 && <div className="onboarding-step-panel havan-motion-enter" key="exams"><StepExams /></div>}
      <Card className="onboarding-summary havan-motion-enter">
        <div><strong>{selectedCount}</strong><span>course{selectedCount === 1 ? '' : 's'} selected</span></div>
        <div><strong>{hours}</strong><span>hours per study day</span></div>
        <div><strong>{days.length}</strong><span>study day{days.length === 1 ? '' : 's'}</span></div>
      </Card>
      <div className="onboarding-actions onboarding-actions-branded">
        {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
        {step < 2
          ? <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button>
          : <Button disabled={!canNext || saving} loading={saving} onClick={finish}>{saving ? 'Saving…' : 'Finish setup'}</Button>}
      </div>
    </main>
  )
}
