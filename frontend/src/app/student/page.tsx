'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import { clearAuth, getAuthToken, getSavedAccount, type AuthAccount } from '../../lib/auth'
import './student.css'

type Item = Record<string, any>
type Collection = { items: Item[]; total: number }

const DAYS = [
  { id: 0, short: 'Sun' },
  { id: 1, short: 'Mon' },
  { id: 2, short: 'Tue' },
  { id: 3, short: 'Wed' },
  { id: 4, short: 'Thu' },
  { id: 5, short: 'Fri' },
  { id: 6, short: 'Sat' },
]

const apiList = async (path: string) => (await apiFetch<Collection>(path)).items

function clientKey() {
  if (typeof window === 'undefined') return ''
  const existing = window.localStorage.getItem('havan_student_key')
  if (existing) return existing
  const key = `student-${crypto.randomUUID()}`
  window.localStorage.setItem('havan_student_key', key)
  return key
}

function initials(name: string): string {
  const letters = name.trim().split(/\\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return letters || 'ST'
}
type HavanOption = { value: string; label: string }
type HavanSelectProps = { value: string; options: HavanOption[]; placeholder: string; disabled?: boolean; onChange: (value: string) => void; ariaLabel?: string }
function HavanSelect({ value, options, placeholder, disabled, onChange, ariaLabel }: HavanSelectProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)
  return (
    <div className={disabled ? 'havan-select disabled' : 'havan-select'}>
      <button type="button" className="havan-select-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel ?? placeholder} disabled={disabled} onClick={() => setOpen((current) => !current)}>
        <span className={selected ? 'has-value' : ''}>{selected?.label ?? placeholder}</span><i>{open ? '−' : '+'}</i>
      </button>
      {open && !disabled && <div className="havan-select-menu" role="listbox">
        {options.length ? options.map((option) => (
          <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'havan-select-option selected' : 'havan-select-option'} key={option.value} onClick={() => { onChange(option.value); setOpen(false) }}>
            <span>{option.label}</span>{option.value === value && <b>✓</b>}
          </button>
        )) : <div className="havan-select-empty">No options available</div>}
      </div>}
    </div>
  )
}

function HavanDatePicker({ value, min, onChange, ariaLabel = 'Select date' }: { value: string; min?: string; onChange: (value: string) => void; ariaLabel?: string }) {
  const [open, setOpen] = useState(false)
  const initial = value ? new Date(value + 'T00:00:00') : new Date()
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1))
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const minDate = min ? new Date(min + 'T00:00:00') : null
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => index < firstDay ? null : index - firstDay + 1)
  const keyFor = (day: number) => month.getFullYear() + '-' + String(month.getMonth() + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0')
  const display = value ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Choose a date'
  return (
    <div className="havan-date-picker">
      <button type="button" className="havan-date-trigger" aria-label={ariaLabel} aria-expanded={open} onClick={() => setOpen((current) => !current)}><span className={value ? 'has-value' : ''}>{display}</span><span className="havan-date-icon">▦</span></button>
      {open && <div className="havan-calendar" role="dialog" aria-label="Calendar">
        <div className="havan-calendar-head"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong>{monthLabel}</strong><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
        <div className="havan-calendar-week"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
        <div className="havan-calendar-grid">{cells.map((day, index) => {
          if (!day) return <span key={'empty-' + index} />
          const key = keyFor(day)
          const current = new Date(key + 'T00:00:00')
          const disabledDay = Boolean(minDate && current < minDate)
          return <button type="button" disabled={disabledDay} className={key === value ? 'selected' : ''} key={key} onClick={() => { onChange(key); setOpen(false) }}>{day}</button>
        })}</div>
      </div>}
    </div>
  )
}

function HavanStepper({ value, min, max, step, onChange, suffix }: { value: number; min: number; max: number; step: number; onChange: (value: number) => void; suffix?: string }) {
  const update = (next: number) => onChange(Math.min(max, Math.max(min, Number(next.toFixed(2)))))
  return <div className="havan-stepper"><button type="button" onClick={() => update(value - step)} disabled={value <= min}>−</button><span><b>{value}</b>{suffix && <small>{suffix}</small>}</span><button type="button" onClick={() => update(value + step)} disabled={value >= max}>+</button></div>
}

export default function StudentPage() {
  const router = useRouter()
  const [account, setAccount] = useState<AuthAccount | null>(getSavedAccount())
  const [studentId, setStudentId] = useState<number | null>(null)
  const [profile, setProfile] = useState<Item | null>(null)
  const [context, setContext] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)

  const [universities, setUniversities] = useState<Item[]>([])
  const [curriculums, setCurriculums] = useState<Item[]>([])
  const [streams, setStreams] = useState<Item[]>([])
  const [courses, setCourses] = useState<Item[]>([])
  const [topics, setTopics] = useState<Item[]>([])
  const [chaptersByCourse, setChaptersByCourse] = useState<Record<string, Item[]>>({})
  const [topicsByChapter, setTopicsByChapter] = useState<Record<string, Item[]>>({})
  const [loadingChapters, setLoadingChapters] = useState<Record<string, boolean>>({})
  const [loadingTopics, setLoadingTopics] = useState<Record<string, boolean>>({})

  const [draft, setDraft] = useState({
    name: '',
    universityId: '',
    curriculumId: '',
    streamId: '',
    courseIds: [] as string[],
    confidence: {} as Record<string, number>,
    studyHours: 2,
    studyDays: [1, 2, 3, 4, 5],
    startingPosition: {} as Record<string, { chapterId: string; topicId: string }>,
  })

  const [draftExams, setDraftExams] = useState<Array<{
    courseId: string
    type: string
    date: string
    importance: number
  }>>([])

  const [examForm, setExamForm] = useState({
    courseId: '',
    type: 'FINAL',
    date: '',
    importance: 4,
  })
  const [editingExamId, setEditingExamId] = useState<number | null>(null)

  async function loadContext(id: number) {
    const data = await apiFetch<Item>(`/students/profiles/${id}/context`)
    setContext(data)
    setProfile(data.profile)
    setStudentId(id)

    const courseItems = await apiList(
      `/courses?stream_id=${data.profile.stream_id}&include_freshman=true&page=1&page_size=100`,
    )
    const selected = courseItems.filter((course: Item) =>
      (data.courses ?? []).some((item: Item) => item.course_id === course.id),
    )
    setCourses(selected)

    const chapters = (
      await Promise.all(
        selected.map((course: Item) =>
          apiList(`/chapters?course_id=${course.id}&page=1&page_size=100`),
        ),
      )
    ).flat()

    const topicItems = (
      await Promise.all(
        chapters.map((chapter: Item) =>
          apiList(`/topics?chapter_id=${chapter.id}&page=1&page_size=100`),
        ),
      )
    ).flat()

    setTopics(topicItems.filter((topic: Item) => String(topic.status).toUpperCase() === 'ACTIVE'))
  }

  useEffect(() => {
    const run = async () => {
      if (!getAuthToken()) {
        router.replace('/auth')
        return
      }
      try {
        const current = await apiFetch<AuthAccount>('/auth/me')
        setAccount(current)
        if (current.student_profile_id) {
          await loadContext(current.student_profile_id)
        }
      } catch (err) {
        clearAuth()
        router.replace('/auth')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [router])

  useEffect(() => {
    if (step === 0 && !universities.length) {
      apiList('/universities?page=1&page_size=100')
        .then(setUniversities)
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not load universities.'))
    }
  }, [step, universities.length])

  useEffect(() => {
    if (!draft.universityId) {
      setCurriculums([])
      return
    }
    apiList(
      `/curriculums?university_id=${draft.universityId}&page=1&page_size=100`,
    ).then(setCurriculums).catch((err) => setError(err instanceof Error ? err.message : 'Could not load curricula.'))
  }, [draft.universityId])

  useEffect(() => {
    if (!draft.curriculumId) {
      setStreams([])
      return
    }
    apiList(
      `/streams?curriculum_id=${draft.curriculumId}&page=1&page_size=100`,
    ).then(setStreams).catch((err) => setError(err instanceof Error ? err.message : 'Could not load streams.'))
  }, [draft.curriculumId])

  useEffect(() => {
    if (!draft.streamId) {
      setCourses([])
      return
    }
    apiList(
      `/courses?stream_id=${draft.streamId}&include_freshman=true&page=1&page_size=100`,
    ).then(setCourses).catch((err) => setError(err instanceof Error ? err.message : 'Could not load courses.'))
  }, [draft.streamId])
  useEffect(() => {
    const selectedIds = draft.courseIds
    if (!selectedIds.length) {
      setChaptersByCourse({})
      return
    }
    const run = async () => {
      const next: Record<string, Item[]> = {}
      for (const courseId of selectedIds) {
        setLoadingChapters((current) => ({ ...current, [courseId]: true }))
        try {
          next[courseId] = await apiList('/chapters?course_id=' + courseId + '&page=1&page_size=100')
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not load course chapters.')
          next[courseId] = []
        } finally {
          setLoadingChapters((current) => ({ ...current, [courseId]: false }))
        }
      }
      setChaptersByCourse(next)
    }
    run()
  }, [draft.courseIds])

  async function loadChapterTopics(chapterId: string) {
    if (!chapterId || topicsByChapter[chapterId]) return
    setLoadingTopics((current) => ({ ...current, [chapterId]: true }))
    try {
      const items = await apiList('/topics?chapter_id=' + chapterId + '&page=1&page_size=100')
      setTopicsByChapter((current) => ({ ...current, [chapterId]: items.filter((item) => String(item.status).toUpperCase() === 'ACTIVE') }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chapter topics.')
    } finally {
      setLoadingTopics((current) => ({ ...current, [chapterId]: false }))
    }
  }
  const selectedCourses = useMemo(
    () => courses.filter((course) => draft.courseIds.includes(String(course.id))),
    [courses, draft.courseIds],
  )

  const completedTopics =
    context?.progress?.filter((item: Item) => item.status === 'COMPLETED').length ?? 0
  const inProgressTopics =
    context?.progress?.filter((item: Item) => item.status === 'IN_PROGRESS').length ?? 0
  const courseTopicStatus: Item[] = context?.course_topic_status ?? []
  const coursesWithoutTopics = courseTopicStatus.filter((item: Item) => item.active_topic_count === 0)
  const hasRegisteredTopics = courseTopicStatus.some((item: Item) => item.active_topic_count > 0)

  async function createProfile() {
    setSaving(true)
    setError('')

    try {
      const created = await apiFetch<Item>('/students/profiles', {
        method: 'POST',
        body: JSON.stringify({
          client_key: clientKey(),
          account_id: account?.id ?? undefined,
          name: draft.name.trim(),
          university_id: Number(draft.universityId),
          curriculum_id: Number(draft.curriculumId),
          stream_id: Number(draft.streamId),
          study_hours_per_day: draft.studyHours,
          study_days: draft.studyDays,
        }),
      })

      for (const courseId of draft.courseIds) {
        await apiFetch(`/students/profiles/${created.id}/courses`, {
          method: 'POST',
          body: JSON.stringify({
            course_id: Number(courseId),
            confidence: draft.confidence[courseId] ?? 3,
            starting_chapter_id: draft.startingPosition[courseId]?.chapterId ? Number(draft.startingPosition[courseId].chapterId) : null,
            starting_topic_id: draft.startingPosition[courseId]?.topicId ? Number(draft.startingPosition[courseId].topicId) : null,
          }),
        })
      }

      for (const exam of draftExams) {
        await apiFetch(`/students/profiles/${created.id}/exams`, {
          method: 'POST',
          body: JSON.stringify({
            course_id: Number(exam.courseId),
            exam_type: exam.type,
            exam_date: exam.date,
            importance: exam.importance,
          }),
        })
      }

      // Build the first deterministic plan before leaving onboarding.
      // Registration is not considered complete from the student's perspective
      // until Havan has something actionable to recommend.
      try {
        await apiFetch(`/planner/generate`, {
          method: 'POST',
          body: JSON.stringify({ student_id: created.id, horizon_days: 7 }),
        })
        window.location.href = '/student/planner'
        return
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Your profile was saved, but Havan could not build the first plan.')
      }

      await loadContext(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your study profile.')
    } finally {
      setSaving(false)
    }
  }

  async function updateProgress(topicId: number, status: string) {
    if (!studentId) return
    try {
      await apiFetch(`/students/profiles/${studentId}/progress/${topicId}`, {
        method: 'PUT',
        body: JSON.stringify({ status, confidence: 3 }),
      })
      await loadContext(studentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update topic progress.')
    }
  }

  async function saveExam() {
    if (!studentId || !examForm.courseId || !examForm.date) return
    setSaving(true)
    setError('')
    try {
      await apiFetch(
        `/students/profiles/${studentId}/exams${editingExamId ? '/' + editingExamId : ''}`,
        {
          method: editingExamId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            course_id: Number(examForm.courseId),
            exam_type: examForm.type,
            exam_date: examForm.date,
            importance: examForm.importance,
          }),
        },
      )
      setExamForm({ courseId: '', type: 'FINAL', date: '', importance: 4 })
      setEditingExamId(null)
      await loadContext(studentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the exam.')
    } finally {
      setSaving(false)
    }
  }

  function beginEditExam(exam: Item) {
    setEditingExamId(exam.id)
    setExamForm({
      courseId: String(exam.course_id),
      type: exam.exam_type,
      date: exam.exam_date,
      importance: Number(exam.importance ?? 3),
    })
  }

  function cancelExamEdit() {
    setEditingExamId(null)
    setExamForm({ courseId: '', type: 'FINAL', date: '', importance: 4 })
  }

  async function deleteExam(examId: number) {
    if (!studentId || saving) return
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/students/profiles/${studentId}/exams/${examId}`, { method: 'DELETE' })
      if (editingExamId === examId) cancelExamEdit()
      await loadContext(studentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the exam.')
    } finally {
      setSaving(false)
    }
  }

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayProgress = useMemo(() => {
    const items = context?.progress ?? []
    return items.filter((item: Item) => item.status === 'IN_PROGRESS').length
  }, [context])

  const academicProgress = useMemo(() => {
    const total = topics.reduce((sum, topic) => sum + Number(topic.estimated_study_minutes || 0), 0)
    const completed = topics.reduce((sum, topic) => {
      const progress = context?.progress?.find((item: Item) => item.topic_id === topic.id)
      return sum + Math.min(Number(progress?.completed_minutes || 0), Number(topic.estimated_study_minutes || 0))
    }, 0)
    return {
      total,
      completed,
      percent: total ? Math.min(100, Math.round((completed / total) * 100)) : 0,
    }
  }, [topics, context])

  const upcomingExam = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return (context?.exams ?? [])
      .map((exam: Item) => {
        const date = new Date(exam.exam_date + 'T00:00:00')
        const days = Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 86400000))
        return { ...exam, date, days }
      })
      .filter((exam: Item) => exam.date >= now)
      .sort((a: Item, b: Item) => a.date.getTime() - b.date.getTime())[0] ?? null
  }, [context])

  const upcomingExamCourse = upcomingExam
    ? courses.find((course) => course.id === upcomingExam.course_id)
    : null

  const courseCards = useMemo(
    () => (context?.courses ?? []).map((item: Item) => {
      const course = courses.find((courseItem) => courseItem.id === item.course_id)
      const courseTopics = topics.filter((topic) => topic.course_id === item.course_id)
      const completed = courseTopics.filter((topic) =>
        context?.progress?.some((progress: Item) => progress.topic_id === topic.id && progress.status === 'COMPLETED'),
      ).length
      return {
        ...item,
        course,
        topicCount: courseTopics.length,
        completed,
        percent: courseTopics.length ? Math.round((completed / courseTopics.length) * 100) : 0,
      }
    }),
    [context, courses, topics],
  )

  if (loading) {
    return <main className="student-shell"><div className="student-loading">Building your Havan study space…</div></main>
  }

  if (!studentId) {
    const selectedCount = draft.courseIds.length

    return (
      <main className="student-shell">
        <header className="student-brand">
          <span className="student-mark">H</span>
          <strong>havan</strong>
          <span>Study Planner</span>
        </header>

        <section className="onboard">
          <div className="student-progress">
            {[0, 1, 2, 3].map((item) => (
              <span key={item} className={item <= step ? 'active' : ''} />
            ))}
          </div>

          {step === 0 && (
            <>
              <span className="student-eyebrow">01 · ACADEMIC IDENTITY</span>
              <h1>Let Havan understand where you actually study.</h1>
              <p className="student-lead">
                Your university and curriculum determine the academic knowledge Havan can use.
                No generic calendar pretending every student has the same workload.
              </p>
              <label>Your name
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Hana" required />
              </label>
              <label>University
                <HavanSelect value={draft.universityId} placeholder="Select university" options={universities.map((item) => ({ value: String(item.id), label: item.name }))} onChange={(value) => setDraft({ ...draft, universityId: value, curriculumId: '', streamId: '', courseIds: [], confidence: {}, startingPosition: {} })} />
              </label>
              <label>Curriculum
                <HavanSelect disabled={!draft.universityId} value={draft.curriculumId} placeholder="Select curriculum" options={curriculums.map((item) => ({ value: String(item.id), label: item.name + ' · v' + item.version }))} onChange={(value) => setDraft({ ...draft, curriculumId: value, streamId: '', courseIds: [], confidence: {}, startingPosition: {} })} />
              </label>
              <label>Stream
                <HavanSelect disabled={!draft.curriculumId} value={draft.streamId} placeholder="Select stream" options={streams.map((item) => ({ value: String(item.id), label: item.name }))} onChange={(value) => setDraft({ ...draft, streamId: value, courseIds: [], confidence: {}, startingPosition: {} })} />
              </label>
              {error && <div className="student-error">{error}</div>}
              <div className="student-actions">
                <button className="student-primary" disabled={!draft.name.trim() || !draft.streamId} onClick={() => setStep(1)}>Continue</button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <span className="student-eyebrow">02 · COURSE SCOPE</span>
              <h1>Tell Havan what you are carrying this term.</h1>
              <p className="student-lead">
                Pick the courses you genuinely need to study. Then rate your confidence.
                That gives the recommendation engine a much better starting signal.
              </p>
              <div className="course-pick-list">
                {courses.map((course) => {
                  const id = String(course.id)
                  const selected = draft.courseIds.includes(id)
                  return (
                    <div className={selected ? 'course-pick selected' : 'course-pick'} key={course.id}>
                      <button
                        className="course-pick-main"
                        onClick={() => setDraft({
                          ...draft,
                          courseIds: selected
                            ? draft.courseIds.filter((value) => value !== id)
                            : [...draft.courseIds, id],
                          confidence: { ...draft.confidence, [id]: draft.confidence[id] ?? 3 },
                        })}
                      >
                        <span><b>{course.code}</b>{course.name}</span>
                        <i>{selected ? '✓' : '+'}</i>
                      </button>
                      {selected && (
                        <div className="course-position-panel">
                          <div className="confidence-pick">
                            <span>Confidence</span>
                            {[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={draft.confidence[id] === value ? 'confidence-dot selected' : 'confidence-dot'} onClick={() => setDraft({ ...draft, confidence: { ...draft.confidence, [id]: value } })}>{value}</button>)}
                          </div>
                          <div className="position-heading"><div><b>Current position</b><span>Optional. Leave blank to start from the beginning.</span></div><em>COURSE</em></div>
                          <div className="position-grid">
                            <HavanSelect value={draft.startingPosition[id]?.chapterId ?? ''} placeholder={loadingChapters[id] ? 'Loading chapters…' : 'Choose chapter (optional)'} options={(chaptersByCourse[id] ?? []).map((chapter) => ({ value: String(chapter.id), label: String(chapter.order_index) + '. ' + chapter.name }))} disabled={Boolean(loadingChapters[id]) || !(chaptersByCourse[id] ?? []).length} onChange={(chapterId) => {
                              setDraft({ ...draft, startingPosition: { ...draft.startingPosition, [id]: { chapterId, topicId: '' } } })
                              loadChapterTopics(chapterId)
                            }} />
                            <HavanSelect value={draft.startingPosition[id]?.topicId ?? ''} placeholder={!draft.startingPosition[id]?.chapterId ? 'Choose chapter first' : loadingTopics[draft.startingPosition[id]?.chapterId ?? ''] ? 'Loading topics…' : 'Choose topic (optional)'} options={(topicsByChapter[draft.startingPosition[id]?.chapterId ?? ''] ?? []).map((topic) => ({ value: String(topic.id), label: String(topic.order_index) + '. ' + topic.name }))} disabled={!draft.startingPosition[id]?.chapterId || Boolean(loadingTopics[draft.startingPosition[id]?.chapterId ?? ''])} onChange={(topicId) => setDraft({ ...draft, startingPosition: { ...draft.startingPosition, [id]: { chapterId: draft.startingPosition[id]?.chapterId ?? '', topicId } } })} />
                          </div>
                          {draft.startingPosition[id]?.chapterId && <p className="position-hint">Havan will begin planning from this chapter{draft.startingPosition[id]?.topicId ? ' and selected topic' : ''}. Earlier material is treated as already covered.</p>}
                        </div>
                      )}                    </div>
                  )
                })}
              </div>
              <div className="selection-note"><b>{selectedCount}</b> course{selectedCount === 1 ? '' : 's'} selected</div>
              <div className="student-actions">
                <button className="student-secondary" onClick={() => setStep(0)}>Back</button>
                <button className="student-primary" disabled={!selectedCount} onClick={() => setStep(2)}>Continue</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <span className="student-eyebrow">03 · EXAM PRESSURE</span>
              <h1>Deadlines change what deserves attention.</h1>
              <p className="student-lead">Add the exams you already know. Havan uses their distance and importance when recommending topics.</p>
              <div className="exam-builder">
                <HavanSelect value={examForm.courseId} placeholder="Course" options={selectedCourses.map((course) => ({ value: String(course.id), label: course.code + ' · ' + course.name }))} onChange={(value) => setExamForm({ ...examForm, courseId: value })} />
                <HavanSelect value={examForm.type} placeholder="Exam type" options={[{ value: 'FINAL', label: 'Final' }, { value: 'MIDTERM', label: 'Midterm' }, { value: 'QUIZ', label: 'Quiz' }]} onChange={(value) => setExamForm({ ...examForm, type: value })} />
                <HavanDatePicker min={new Date().toISOString().slice(0, 10)} value={examForm.date} onChange={(value) => setExamForm({ ...examForm, date: value })} />
                <HavanSelect value={String(examForm.importance)} placeholder="Importance" options={[{ value: '5', label: 'Critical' }, { value: '4', label: 'Important' }, { value: '3', label: 'Normal' }, { value: '2', label: 'Low' }, { value: '1', label: 'Minor' }]} onChange={(value) => setExamForm({ ...examForm, importance: Number(value) })} />
                <button className="student-secondary" disabled={!examForm.courseId || !examForm.date} onClick={() => { setDraftExams([...draftExams, { ...examForm }]); setExamForm({ ...examForm, courseId: '', date: '' }) }}>Add exam</button>
              </div>
              {draftExams.length > 0 ? (
                <div className="draft-exams">{draftExams.map((exam, index) => {
                  const course = selectedCourses.find((item) => String(item.id) === exam.courseId)
                  return <div className="draft-exam" key={index}><div><b>{course?.code}</b><span>{exam.type} · {exam.date}</span></div><button onClick={() => setDraftExams(draftExams.filter((_, i) => i !== index))}>Remove</button></div>
                })}</div>
              ) : <div className="exam-empty">No exams added yet. You can add them later.</div>}
              <div className="student-actions">
                <button className="student-secondary" onClick={() => setStep(1)}>Back</button>
                <button className="student-primary" onClick={() => setStep(3)}>Continue</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <span className="student-eyebrow">04 · REALISTIC CAPACITY</span>
              <h1>Give the planner a boundary, not a fantasy.</h1>
              <p className="student-lead">Havan recommends work inside this capacity. You remain in control and can move, skip, complete, or regenerate tasks later.</p>
              <label>Study hours per day
                <HavanStepper value={draft.studyHours} min={0.5} max={12} step={0.5} suffix="h / day" onChange={(value) => setDraft({ ...draft, studyHours: value })} />
              </label>
              <span className="day-label">Normal study days</span>
              <div className="day-pick">{DAYS.map((day) => <button key={day.id} className={draft.studyDays.includes(day.id) ? 'day selected' : 'day'} onClick={() => setDraft({ ...draft, studyDays: draft.studyDays.includes(day.id) ? draft.studyDays.filter((id) => id !== day.id) : [...draft.studyDays, day.id] })}>{day.short}</button>)}</div>
              <div className="capacity"><b>{(draft.studyHours * draft.studyDays.length).toFixed(1)}h</b><span>normal weekly study capacity</span></div>
              <div className="review-card"><b>{draft.name}</b><span>{universities.find((item) => String(item.id) === draft.universityId)?.name}</span><span>{streams.find((item) => String(item.id) === draft.streamId)?.name}</span><span>{selectedCount} courses · {draftExams.length} exams · {draft.studyHours}h/day</span></div>
              {error && <div className="student-error">{error}</div>}
              <div className="student-actions">
                <button className="student-secondary" onClick={() => setStep(2)}>Back</button>
                <button className="student-primary" disabled={saving || !draft.studyDays.length} onClick={createProfile}>{saving ? 'Building your plan…' : 'Create my study space'}</button>
              </div>
            </>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="student-shell dashboard-shell">
      <header className="student-topbar student-dashboard-topbar">
        <a className="student-brand" href="/student">
          <span className="student-mark">H</span>
          <strong>havan</strong>
          <span>Study Planner</span>
        </a>
        <nav className="dashboard-nav" aria-label="Student navigation">
          <span className="student-context">{profile?.study_hours_per_day ?? 0}h/day</span>
          <button
            type="button"
            className="dashboard-profile-button"
            onClick={() => router.push('/student/settings')}
            aria-label="Open your Havan profile settings"
            title="Profile settings"
          >
            <span className="dashboard-avatar">{initials(profile?.name ?? '')}</span>
            <span>{profile?.name ?? 'Student'}</span>
          </button>
        </nav>
      </header>

      {error && (
        <div className="student-error top-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
        </div>
      )}

      <section className="dashboard-welcome">
        <div>
          <span className="student-eyebrow">HAVAN STUDENT DASHBOARD</span>
          <h1>Good to see you, {profile?.name?.split(' ')[0] ?? 'Student'}.</h1>
          <p>Your plan, progress, and next academic priority in one simple view.</p>
        </div>
        <a className="hero-action dashboard-primary-action" href="/student/planner">Open study plan <span>→</span></a>
      </section>

      <section className="dashboard-kpis" aria-label="Study overview">
        <article className="dashboard-kpi dashboard-kpi-primary">
          <span>ACADEMIC PROGRESS</span>
          <strong>{academicProgress.percent}%</strong>
          <div className="dashboard-progress-track"><i style={{ width: academicProgress.percent + '%' }} /></div>
          <small>{completedTopics} of {topics.length} topics complete</small>
        </article>
        <article className="dashboard-kpi">
          <span>IN PROGRESS</span>
          <strong>{todayProgress}</strong>
          <small>topics currently active</small>
        </article>
        <article className="dashboard-kpi">
          <span>COURSES</span>
          <strong>{context?.courses?.length ?? 0}</strong>
          <small>{topics.length} active topics in scope</small>
        </article>
        <article className="dashboard-kpi">
          <span>NEXT EXAM</span>
          <strong>{upcomingExam ? (upcomingExam.days === 0 ? 'Today' : upcomingExam.days + 'd') : '—'}</strong>
          <small>{upcomingExamCourse?.code ?? 'No upcoming exam'}</small>
        </article>
      </section>

      <section className="dashboard-focus-grid">
        <article className="dashboard-focus-card dashboard-next-card">
          <div className="dashboard-card-head">
            <div><span className="student-eyebrow">NEXT PRIORITY</span><h2>{upcomingExam ? upcomingExamCourse?.name ?? 'Upcoming exam' : 'Your study plan'}</h2></div>
            <span className="dashboard-card-mark">01</span>
          </div>
          {upcomingExam ? (
            <>
              <p className="dashboard-focus-date">{upcomingExam.exam_type} · {upcomingExam.exam_date}</p>
              <div className="dashboard-exam-countdown"><strong>{upcomingExam.days === 0 ? 'Today' : upcomingExam.days}</strong><span>{upcomingExam.days === 0 ? 'exam day' : 'days remaining'}</span></div>
              <p>Havan uses this deadline and its importance when ordering recommendations for you.</p>
              <a className="dashboard-text-link" href="/student/planner">See recommendations →</a>
            </>
          ) : (
            <>
              <p>No upcoming exam is registered yet. Your planner can still work from progress, confidence, and capacity.</p>
              <a className="dashboard-text-link" href="#assessments">Add an exam →</a>
            </>
          )}
        </article>

        <article className="dashboard-focus-card dashboard-progress-card">
          <div className="dashboard-card-head">
            <div><span className="student-eyebrow">PROGRESS</span><h2>Keep moving</h2></div>
            <span className="dashboard-card-mark">02</span>
          </div>
          <div className="dashboard-big-progress"><span style={{ width: academicProgress.percent + '%' }} /></div>
          <div className="dashboard-progress-copy"><strong>{academicProgress.completed} min</strong><span>completed study time</span></div>
          <p>{academicProgress.percent === 100 ? 'Everything currently in scope is complete.' : 'Your progress helps Havan decide what deserves another session.'}</p>
          <a className="dashboard-text-link" href="#progress">Update topic progress →</a>
        </article>
      </section>

      <section className="panel dashboard-courses-panel">
        <div className="dashboard-section-head">
          <div><span className="student-eyebrow">COURSE SCOPE</span><h2>Your courses</h2></div>
          <span>{courseCards.length} selected</span>
        </div>
        <div className="dashboard-course-grid">
          {courseCards.map((item: any) => (
            <article className="dashboard-course-card" key={item.id}>
              <div className="dashboard-course-top">
                <span>{item.course?.code ?? 'COURSE'}</span>
                <b>{item.percent}%</b>
              </div>
              <h3>{item.course?.name ?? 'Course'}</h3>
              <p>{item.completed} of {item.topicCount} topics complete</p>
              <div className="dashboard-progress-track"><i style={{ width: item.percent + '%' }} /></div>
              <span className="confidence">Confidence {item.confidence ?? '—'}/5</span>
            </article>
          ))}
        </div>
      </section>

      {!hasRegisteredTopics && context?.courses?.length > 0 && (
        <section className="panel topic-registration-warning">
          <div className="panel-heading"><div><span className="student-eyebrow">ACADEMIC DATA STATUS</span><h2>No topics registered yet</h2></div></div>
          <p>Your selected courses are registered, but Havan needs active chapters and topics before it can generate academic recommendations.</p>
          <div className="topic-status-list">{courseTopicStatus.map((item: Item) => (
            <div className="topic-status-row" key={item.course_id}><div><b>{item.course_code}</b><span>{item.course_name}</span></div><strong>{item.chapter_count} chapters · {item.active_topic_count} topics</strong></div>
          ))}</div>
        </section>
      )}

      {hasRegisteredTopics && coursesWithoutTopics.length > 0 && (
        <section className="panel topic-registration-warning">
          <div className="panel-heading"><div><span className="student-eyebrow">ACADEMIC DATA STATUS</span><h2>Some courses need topics</h2></div></div>
          <p>Havan can recommend from courses with registered topics. These selected courses still need academic content.</p>
          <div className="topic-status-list">{coursesWithoutTopics.map((item: Item) => (
            <div className="topic-status-row" key={item.course_id}><div><b>{item.course_code}</b><span>{item.course_name}</span></div><strong>{item.chapter_count} chapters · 0 topics</strong></div>
          ))}</div>
        </section>
      )}

      <section className="dashboard-manage-grid">
        <details className="panel dashboard-details" id="assessments">
          <summary><span><span className="student-eyebrow">ASSESSMENTS</span><b>Manage exam dates</b></span><i>+</i></summary>
          <div className="dashboard-details-body">
            {context?.exams?.length ? context.exams.map((exam: Item) => {
              const course = courses.find((item) => item.id === exam.course_id)
              const days = Math.max(0, Math.ceil((new Date(exam.exam_date + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86400000))
              return (
                <div className="exam-row exam-row-managed" key={exam.id}>
                  <div><b>{course?.code ?? 'Course'}</b><span>{exam.exam_type} · Importance {exam.importance}/5 · {days === 0 ? 'Today' : days + 'd left'}</span></div>
                  <div className="exam-row-actions"><strong>{exam.exam_date}</strong><button type="button" onClick={() => beginEditExam(exam)}>Edit</button><button type="button" onClick={() => deleteExam(exam.id)} disabled={saving}>Remove</button></div>
                </div>
              )
            }) : <p className="muted">No exam dates yet.</p>}
            <div className="exam-form">
              <HavanSelect value={examForm.courseId} placeholder="Course" options={courses.map((course) => ({ value: String(course.id), label: course.code }))} onChange={(value) => setExamForm({ ...examForm, courseId: value })} />
              <HavanSelect value={examForm.type} placeholder="Exam type" options={[{ value: 'FINAL', label: 'Final' }, { value: 'MIDTERM', label: 'Midterm' }, { value: 'QUIZ', label: 'Quiz' }]} onChange={(value) => setExamForm({ ...examForm, type: value })} />
              <HavanDatePicker min={todayKey} value={examForm.date} onChange={(value) => setExamForm({ ...examForm, date: value })} />
              <HavanSelect value={String(examForm.importance)} placeholder="Importance" options={[{ value: '5', label: 'Critical' }, { value: '4', label: 'Important' }, { value: '3', label: 'Normal' }, { value: '2', label: 'Low' }, { value: '1', label: 'Minor' }]} onChange={(value) => setExamForm({ ...examForm, importance: Number(value) })} />
              <div className="exam-form-actions"><button type="button" className="student-secondary" disabled={saving || !examForm.courseId || !examForm.date} onClick={saveExam}>{saving ? 'Saving…' : editingExamId ? 'Save changes' : 'Add exam'}</button>{editingExamId && <button type="button" className="student-secondary" onClick={cancelExamEdit}>Cancel</button>}</div>
            </div>
          </div>
        </details>

        <details className="panel dashboard-details" id="progress">
          <summary><span><span className="student-eyebrow">TOPIC PROGRESS</span><b>Update what you know</b></span><i>+</i></summary>
          <div className="dashboard-details-body">
            {topics.slice(0, 20).map((topic) => {
              const progress = context?.progress?.find((item: Item) => item.topic_id === topic.id)
              const status = progress?.status ?? 'NOT_STARTED'
              return (
                <div className="topic-row" key={topic.id}>
                  <div><b>{topic.name}</b><span>{topic.estimated_study_minutes} min · difficulty {topic.difficulty}/5</span></div>
                  <button className={status === 'COMPLETED' ? 'progress-button complete' : status === 'IN_PROGRESS' ? 'progress-button active' : 'progress-button'} onClick={() => updateProgress(topic.id, status === 'NOT_STARTED' ? 'IN_PROGRESS' : status === 'IN_PROGRESS' ? 'COMPLETED' : 'NOT_STARTED')}>
                    {status === 'NOT_STARTED' ? 'Start' : status === 'IN_PROGRESS' ? 'Complete' : 'Completed'}
                  </button>
                </div>
              )
            })}
          </div>
        </details>
      </section>

      <p className="student-footer">Havan recommends. You decide what actually happens.</p>
    </main>
  )
}