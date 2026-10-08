'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, ErrorState } from '@/components/ui'
import { HavanLogo } from '@/components/brand/HavanLogo'
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
  const [days, setDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri'])
  type OnboardingExam = { course_id: number; exam_type: string; exam_date: string; importance: number; selected_topic_ids: number[] }
  const [hours, setHours] = useState(2)
  const [exams, setExams] = useState<OnboardingExam[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!getAuthToken()) router.replace('/auth')
  }, [router])

  const validAcademic = Boolean(name.trim() && university && curriculum && stream && selected.size)
  const canNext = step === 0 ? validAcademic : step === 1 ? days.length > 0 : true
  const stepLabels = ['Profile', 'Study routine', 'Exams'] as const
  const stepContent = [
    {
      eyebrow: 'YOUR ACADEMIC PROFILE',
      title: 'Start with the essentials',
      description: 'Tell us where you study and choose the courses you want Havan to plan around.',
    },
    {
      eyebrow: 'YOUR STUDY ROUTINE',
      title: 'Set a comfortable rhythm',
      description: 'Choose the days and study time that fit your week. You can adjust them later.',
    },
    {
      eyebrow: 'OPTIONAL · EXAMS',
      title: 'Add exams now or later',
      description: 'Adding dates helps Havan prioritize your plan. You can skip this and add exams anytime.',
    },
  ] as const
  const selectedCount = selected.size

  function handleUniversity(value: string) {
    setUniversity(value)
    setCurriculum('')
    setStream('')
    setSelected(new Set())
  }

  function handleCurriculum(value: string) {
    setCurriculum(value)
    setStream('')
    setSelected(new Set())
  }

  function handleStream(value: string) {
    setStream(value)
    setSelected(new Set())
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
          exams,
          courses: Array.from(selected).map((courseId) => {
            return { course_id: courseId, confidence: 3 }
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
    <main className="onboarding-shell onboarding-journey onboarding-redesign">
      <header className="onboarding-topbar">
        <HavanLogo size={42} variant="dark" />
        <span className="onboarding-topbar-caption">Your study planner</span>
        <span className="onboarding-step-count">Step {step + 1} of 3</span>
      </header>
      <div className="onboarding-welcome">
        <span className="onboarding-welcome-kicker">A BETTER WAY TO PLAN</span>
        <h1>Make Havan fit your semester.</h1>
        <p>A few details help us shape a study plan around your courses, time, and goals.</p>
      </div>
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
            <span className="onboarding-progress-number">{index + 1}</span>
            <span className="onboarding-progress-copy">
              <strong>{label}</strong>
              <small>{index < step ? 'Complete' : index === step ? 'In progress' : 'Up next'}</small>
            </span>
          </button>
        ))}
      </div>
      <section className="onboarding-stage" aria-labelledby="onboarding-step-title">
        <header className="onboarding-stage-heading">
          <span>{stepContent[step].eyebrow}</span>
          <h2 id="onboarding-step-title">{stepContent[step].title}</h2>
          <p>{stepContent[step].description}</p>
        </header>
      {error && <ErrorState message={error} onRetry={() => setError('')} />}
      {step === 0 && (
        <StepAcademic
          name={name}
          university={university}
          curriculum={curriculum}
          stream={stream}
          selected={selected}
          onName={setName}
          onUniversity={handleUniversity}
          onCurriculum={handleCurriculum}
          onStream={handleStream}
          onToggleCourse={(id, checked) =>
            setSelected((old) => {
              const next = new Set(old)
              if (checked) next.add(id)
              else next.delete(id)
              return next
            })
          }
        />
      )}
      {step === 1 && <div className="onboarding-step-panel" key="habits"><StepHabits days={days} hours={hours} onDays={setDays} onHours={setHours} /></div>}
      {step === 2 && <div className="onboarding-step-panel" key="exams"><StepExams streamId={stream} selectedCourseIds={selected} exams={exams} onExams={setExams} /></div>}
      <Card className="onboarding-summary">
        <div><strong>{selectedCount}</strong><span>courses</span></div>
        <div><strong>{hours}h</strong><span>per study day</span></div>
        <div><strong>{days.length}</strong><span>study days</span></div>
      </Card>
      <footer className="onboarding-actions onboarding-actions-branded">
        {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
        {step < 2
          ? <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button>
          : (
            <>
              <Button variant="secondary" disabled={saving} onClick={finish}>Skip exams</Button>
              <Button disabled={!canNext || saving} loading={saving} onClick={finish}>{saving ? 'Saving…' : 'Finish setup'}</Button>
            </>
          )}
      </footer>
      </section>
    </main>
  )
}
