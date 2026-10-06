'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, ErrorState, Segmented } from '@/components/ui'
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

  useEffect(() => {
    if (!getAuthToken()) router.replace('/auth')
  }, [router])

  const validAcademic = Boolean(name.trim() && university && curriculum && stream && selected.size)
  const canNext = step === 0 ? validAcademic : step === 1 ? days.length > 0 : true

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
    setError('')
    try {
      const profile = await apiFetch<{ id: number }>('/students/profiles', {
        method: 'POST',
        body: JSON.stringify({
          name,
          university_id: Number(university),
          curriculum_id: Number(curriculum),
          stream_id: Number(stream),
          study_hours_per_day: hours,
          study_days: days,
        }),
      })

      for (const courseId of selected) {
        const start = starts[courseId]
        await apiFetch(`/students/profiles/${profile.id}/courses`, {
          method: 'POST',
          body: JSON.stringify({
            course_id: courseId,
            confidence: 3,
            starting_chapter_id: start?.chapter,
            starting_topic_id: start?.topic,
          }),
        })
      }

      const account = await apiFetch<{ id: number; email: string; role: 'STUDENT' | 'ADMIN'; student_profile_id: number | null }>('/auth/me')
      const token = getAuthToken()
      if (token) saveAuth({ access_token: token, token_type: 'bearer', account })
      router.replace('/home')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save your academic setup.')
    }
  }

  return (
    <main className="onboarding-shell">
      <span className="onboarding-brand">HAVAN</span>
      <h1>Set up your academic profile</h1>
      <p className="onboarding-intro">Tell Havan where you are and when you study. You can change these choices later.</p>
      <Segmented
        options={['Academic', 'Habits', 'Exams'] as const}
        value={['Academic', 'Habits', 'Exams'][step] as 'Academic' | 'Habits' | 'Exams'}
        onChange={(value) => setStep(['Academic', 'Habits', 'Exams'].indexOf(value))}
      />
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
      {step === 1 && <StepHabits days={days} hours={hours} onDays={setDays} onHours={setHours} />}
      {step === 2 && <StepExams />}
      <div className="onboarding-actions">
        {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
        {step < 2
          ? <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button>
          : <Button disabled={!canNext} onClick={finish}>Finish setup</Button>}
      </div>
    </main>
  )
}
