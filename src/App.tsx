import { useEffect, useMemo, useState } from 'react'
import {
  buildPlan,
  formatActivity,
  formatTime,
  formatWeekdayDate,
  getDateForWeekday,
  getDateInputValue,
  getRecommendedMode,
  getWeekStart,
  getModeCopy,
  weekdayLabels,
  weekdayOrder,
  type Course,
  type PlanItem,
  type PlanMode,
  type StudentProfile,
} from './domain/plan'
import { initialiseTelegram } from './lib/telegram'
import './index.css'

type PlannerState = {
  ready: boolean
  profile: StudentProfile
  plan: PlanItem[]
  activeMode: PlanMode
  selectedDay: number
}

type Sheet = 'actions' | 'reschedule' | 'add' | null

const storageKey = 'havan-study-planner-v1'

const makeInitialProfile = (): StudentProfile => {
  const assessmentDate = new Date()
  assessmentDate.setDate(assessmentDate.getDate() + 10)

  return {
    university: '',
    stream: 'natural',
    courses: [
      { id: 'mathematics', name: 'Mathematics', topic: 'Chapter 3: Functions' },
      { id: 'physics', name: 'Physics', topic: 'Chapter 2: Motion' },
      { id: 'english', name: 'English', topic: 'Chapter 4: Academic writing' },
    ],
    assessment: {
      courseId: 'mathematics',
      name: 'Mathematics midterm',
      date: getDateInputValue(assessmentDate),
    },
    studyDays: [1, 3, 5, 6],
    studyHours: 3,
  }
}

const makeInitialState = (): PlannerState => ({
  ready: false,
  profile: makeInitialProfile(),
  plan: [],
  activeMode: 'keep-up',
  selectedDay: 1,
})

function loadState(): PlannerState {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return makeInitialState()
    const parsed = JSON.parse(stored) as PlannerState
    if (!parsed.profile || !Array.isArray(parsed.plan)) return makeInitialState()
    return parsed
  } catch {
    return makeInitialState()
  }
}

function formatWeekRange() {
  const start = getWeekStart()
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  return `${formatter.format(start)} – ${formatter.format(end)}`
}

function App() {
  const [state, setState] = useState<PlannerState>(loadState)
  const [step, setStep] = useState(0)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [rescheduleDay, setRescheduleDay] = useState(1)
  const [rescheduleTime, setRescheduleTime] = useState('17:30')
  const [newItem, setNewItem] = useState({ title: '', topic: '', courseId: '', day: 1, duration: 45 })

  useEffect(() => {
    initialiseTelegram()
  }, [])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state])

  const recommendedMode = useMemo(
    () => getRecommendedMode(state.profile, state.plan),
    [state.profile, state.plan],
  )
  const modeCopy = getModeCopy(state.activeMode, state.profile)
  const activeItem = state.plan.find((item) => item.id === activeItemId) ?? null
  const selectedItems = state.plan
    .filter((item) => item.day === state.selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time))
  const completedItems = state.plan.filter((item) => item.status === 'completed').length
  const totalMinutes = state.plan
    .filter((item) => item.status !== 'skipped')
    .reduce((sum, item) => sum + item.duration, 0)
  const capacityMinutes = state.profile.studyDays.length * state.profile.studyHours * 60

  const updateProfile = (update: Partial<StudentProfile>) => {
    setState((current) => ({ ...current, profile: { ...current.profile, ...update } }))
  }

  const updateCourse = (courseId: string, update: Partial<Course>) => {
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        courses: current.profile.courses.map((course) =>
          course.id === courseId ? { ...course, ...update } : course,
        ),
      },
    }))
  }

  const generatePlan = () => {
    const plan = buildPlan(state.profile)
    const recommended = getRecommendedMode(state.profile, plan)
    setState((current) => ({
      ...current,
      ready: true,
      plan,
      activeMode: recommended,
      selectedDay: current.profile.studyDays[0] ?? 1,
    }))
  }

  const updateItem = (itemId: string, update: Partial<PlanItem>) => {
    setState((current) => ({
      ...current,
      plan: current.plan.map((item) => (item.id === itemId ? { ...item, ...update } : item)),
    }))
  }

  const getNextStudyDay = (fromDay: number) => {
    const order = weekdayOrder
    const start = order.indexOf(fromDay)
    for (let offset = 1; offset <= order.length; offset += 1) {
      const candidate = order[(start + offset) % order.length]
      if (state.profile.studyDays.includes(candidate)) return candidate
    }
    return state.profile.studyDays[0] ?? fromDay
  }

  const openActions = (item: PlanItem) => {
    setActiveItemId(item.id)
    setRescheduleDay(getNextStudyDay(item.day))
    setRescheduleTime(item.time)
    setSheet('actions')
  }

  const moveToNextSlot = () => {
    if (!activeItem) return
    const nextDay = getNextStudyDay(activeItem.day)
    updateItem(activeItem.id, { day: nextDay, status: 'scheduled' })
    setState((current) => ({ ...current, selectedDay: nextDay }))
    setSheet(null)
  }

  const rescheduleItem = () => {
    if (!activeItem) return
    updateItem(activeItem.id, { day: rescheduleDay, time: rescheduleTime, status: 'scheduled' })
    setState((current) => ({ ...current, selectedDay: rescheduleDay }))
    setSheet(null)
  }

  const addPlanItem = () => {
    if (!newItem.title.trim()) return
    const course = state.profile.courses.find((item) => item.id === newItem.courseId)
    const item: PlanItem = {
      id: `manual-${Date.now()}`,
      courseId: course?.id,
      title: newItem.title.trim(),
      topic: newItem.topic.trim() || course?.topic || 'Personal focus',
      day: newItem.day,
      time: '17:30',
      duration: newItem.duration,
      activity: 'personal',
      status: 'scheduled',
      source: 'manual',
      reason: 'Added by you.',
    }
    setState((current) => ({ ...current, plan: [...current.plan, item], selectedDay: newItem.day }))
    setNewItem({ title: '', topic: '', courseId: state.profile.courses[0]?.id ?? '', day: newItem.day, duration: 45 })
    setSheet(null)
  }

  const resetPlanner = () => {
    if (!window.confirm('Start over? Your locally saved plan will be removed.')) return
    const fresh = makeInitialState()
    window.localStorage.removeItem(storageKey)
    setState(fresh)
    setStep(0)
  }

  const canContinue =
    (step === 0 && state.profile.university.trim().length > 0) ||
    (step === 1 && state.profile.courses.some((course) => course.name.trim() && course.topic.trim())) ||
    step === 2 ||
    (step === 3 && state.profile.studyDays.length >= 2)

  if (!state.ready) {
    return (
      <main className="onboarding-page">
        <header className="brand-header">
          <div className="brand-lockup" aria-label="Havan">
            <span className="brand-mark">H</span>
            <span>havan</span>
          </div>
          <span className="header-note">Study planner</span>
        </header>

        <section className="onboarding-card">
          <div className="stepper" aria-label={`Step ${step + 1} of 4`}>
            {[0, 1, 2, 3].map((item) => (
              <span key={item} className={item <= step ? 'step-dot is-active' : 'step-dot'} />
            ))}
          </div>
          <span className="eyebrow">STEP {step + 1} OF 4</span>

          {step === 0 && (
            <>
              <h1>Start from where you are.</h1>
              <p className="intro-copy">Havan will recommend a realistic path. You will always stay in control.</p>
              <label className="field-label" htmlFor="university">Your university</label>
              <input
                id="university"
                className="text-input"
                value={state.profile.university}
                onChange={(event) => updateProfile({ university: event.target.value })}
                placeholder="e.g. Addis Ababa University"
                autoComplete="organization"
              />
              <span className="field-label">Your stream</span>
              <div className="choice-grid">
                <button
                  className={state.profile.stream === 'natural' ? 'choice-card is-selected' : 'choice-card'}
                  onClick={() => updateProfile({ stream: 'natural' })}
                  type="button"
                >
                  <strong>Natural Sciences</strong>
                  <small>Maths, science, health & technology</small>
                </button>
                <button
                  className={state.profile.stream === 'social' ? 'choice-card is-selected' : 'choice-card'}
                  onClick={() => updateProfile({ stream: 'social' })}
                  type="button"
                >
                  <strong>Social Sciences</strong>
                  <small>Humanities, society & business</small>
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1>What are you studying?</h1>
              <p className="intro-copy">Add your current courses and the topic your class is on now.</p>
              <div className="course-editor-list">
                {state.profile.courses.map((course, index) => (
                  <div className="course-editor" key={course.id}>
                    <div className="course-editor-topline">
                      <span>Course {index + 1}</span>
                      {state.profile.courses.length > 1 && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => updateProfile({ courses: state.profile.courses.filter((item) => item.id !== course.id) })}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      className="text-input compact"
                      value={course.name}
                      onChange={(event) => updateCourse(course.id, { name: event.target.value })}
                      placeholder="Course name"
                    />
                    <input
                      className="text-input compact"
                      value={course.topic}
                      onChange={(event) => updateCourse(course.id, { topic: event.target.value })}
                      placeholder="Current chapter or topic"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="secondary-button full-width"
                onClick={() =>
                  updateProfile({
                    courses: [
                      ...state.profile.courses,
                      { id: `course-${Date.now()}`, name: '', topic: '' },
                    ],
                  })
                }
              >
                Add another course
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h1>What is coming up?</h1>
              <p className="intro-copy">Exam dates are optional. Add one when you know it and Havan will adjust the recommendation.</p>
              {state.profile.assessment ? (
                <div className="assessment-form">
                  <div className="course-editor-topline">
                    <span>Upcoming assessment</span>
                    <button type="button" className="text-button" onClick={() => updateProfile({ assessment: undefined })}>
                      I do not know yet
                    </button>
                  </div>
                  <input
                    className="text-input compact"
                    value={state.profile.assessment.name}
                    onChange={(event) =>
                      updateProfile({ assessment: { ...state.profile.assessment!, name: event.target.value } })
                    }
                    placeholder="e.g. Mathematics midterm"
                  />
                  <select
                    className="text-input compact"
                    value={state.profile.assessment.courseId}
                    onChange={(event) =>
                      updateProfile({ assessment: { ...state.profile.assessment!, courseId: event.target.value } })
                    }
                  >
                    {state.profile.courses.filter((course) => course.name).map((course) => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                  <input
                    className="text-input compact"
                    type="date"
                    value={state.profile.assessment.date}
                    onChange={(event) =>
                      updateProfile({ assessment: { ...state.profile.assessment!, date: event.target.value } })
                    }
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="secondary-button full-width"
                  onClick={() =>
                    updateProfile({
                      assessment: {
                        courseId: state.profile.courses[0]?.id ?? '',
                        name: 'Upcoming assessment',
                        date: getDateInputValue(new Date()),
                      },
                    })
                  }
                >
                  Add an exam date
                </button>
              )}
              <div className="quiet-note">You can add or change exam dates at any time after creating your plan.</div>
            </>
          )}

          {step === 3 && (
            <>
              <h1>Make it fit your life.</h1>
              <p className="intro-copy">Choose your usual study days and the time you can honestly give each day.</p>
              <span className="field-label">Study days</span>
              <div className="day-picker">
                {weekdayOrder.map((day) => (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={state.profile.studyDays.includes(day)}
                    className={state.profile.studyDays.includes(day) ? 'day-choice is-selected' : 'day-choice'}
                    onClick={() => {
                      const selected = state.profile.studyDays.includes(day)
                      updateProfile({
                        studyDays: selected
                          ? state.profile.studyDays.filter((item) => item !== day)
                          : [...state.profile.studyDays, day],
                      })
                    }}
                  >
                    {weekdayLabels[day].short}
                  </button>
                ))}
              </div>
              <div className="hours-control">
                <div>
                  <span className="field-label">Time per study day</span>
                  <strong>{state.profile.studyHours} hours</strong>
                </div>
                <div className="hour-options">
                  {[1, 2, 3, 4].map((hours) => (
                    <button
                      type="button"
                      key={hours}
                      onClick={() => updateProfile({ studyHours: hours })}
                      className={state.profile.studyHours === hours ? 'hour-option is-selected' : 'hour-option'}
                    >
                      {hours}h
                    </button>
                  ))}
                </div>
              </div>
              <div className="capacity-preview">
                <strong>{state.profile.studyDays.length * state.profile.studyHours} hours</strong>
                <span>of focused study time available this week</span>
              </div>
            </>
          )}

          <footer className="onboarding-footer">
            {step > 0 && (
              <button className="back-button" type="button" onClick={() => setStep((current) => current - 1)}>
                Back
              </button>
            )}
            <button
              className="primary-button"
              type="button"
              disabled={!canContinue}
              onClick={() => (step === 3 ? generatePlan() : setStep((current) => current + 1))}
            >
              {step === 3 ? 'Create my study plan' : 'Continue'}
            </button>
          </footer>
        </section>
      </main>
    )
  }

  return (
    <main className="planner-page">
      <header className="planner-header">
        <div className="brand-lockup" aria-label="Havan">
          <span className="brand-mark">H</span>
          <span>havan</span>
        </div>
        <button className="reset-button" type="button" onClick={resetPlanner}>Start over</button>
      </header>

      <section className="greeting-section">
        <span className="eyebrow">YOUR STUDY WEEK</span>
        <h1>One focused step at a time.</h1>
        <p>{formatWeekRange()} · {state.profile.university}</p>
      </section>

      <section className="summary-row" aria-label="Weekly plan summary">
        <div className="summary-card">
          <strong>{Math.round(totalMinutes / 60 * 10) / 10}h</strong>
          <span>recommended</span>
        </div>
        <div className="summary-card">
          <strong>{Math.round(capacityMinutes / 60)}h</strong>
          <span>available</span>
        </div>
        <div className="summary-card">
          <strong>{completedItems}/{state.plan.length}</strong>
          <span>complete</span>
        </div>
      </section>

      <section className="mode-section" aria-label="Planning mode">
        <div className="mode-switcher">
          {(['keep-up', 'catch-up', 'exam'] as PlanMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setState((current) => ({ ...current, activeMode: mode }))}
              className={state.activeMode === mode ? 'mode-button is-active' : 'mode-button'}
            >
              {mode === 'keep-up' ? 'Keep-Up' : mode === 'catch-up' ? 'Catch-Up' : 'Exam'}
            </button>
          ))}
        </div>
        <div className={`mode-hero ${state.activeMode}`}>
          <div>
            <span className="mode-eyebrow">{modeCopy.eyebrow}</span>
            <h2>{modeCopy.title}</h2>
            <p>{modeCopy.body}</p>
          </div>
          {state.activeMode !== recommendedMode && (
            <button
              type="button"
              className="link-button"
              onClick={() => setState((current) => ({ ...current, activeMode: recommendedMode }))}
            >
              Use recommendation
            </button>
          )}
        </div>
      </section>

      <section className="recommendation-card">
        <div className="recommendation-icon">R</div>
        <div>
          <span className="eyebrow">HAVAN RECOMMENDS</span>
          <strong>
            {state.activeMode === 'exam'
              ? 'Keep your first session for assessment practice.'
              : state.activeMode === 'catch-up'
                ? 'Use the flexible buffer before adding more work.'
                : 'Protect the flexible buffer at the end of your week.'}
          </strong>
        </div>
      </section>

      <section className="week-section" aria-label="Select day">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR PLAN</span>
            <h2>This week</h2>
          </div>
          <span className="day-count">{state.plan.filter((item) => item.status === 'scheduled').length} sessions left</span>
        </div>
        <div className="week-strip">
          {weekdayOrder.map((day) => {
            const date = getDateForWeekday(day)
            const hasPlan = state.plan.some((item) => item.day === day)
            return (
              <button
                key={day}
                type="button"
                onClick={() => setState((current) => ({ ...current, selectedDay: day }))}
                className={state.selectedDay === day ? 'week-day is-active' : 'week-day'}
              >
                <span>{weekdayLabels[day].short}</span>
                <strong>{date.getDate()}</strong>
                {hasPlan && <i />}
              </button>
            )
          })}
        </div>
      </section>

      <section className="agenda-section">
        <div className="section-heading agenda-heading">
          <div>
            <span className="eyebrow">{formatWeekdayDate(state.selectedDay)}</span>
            <h2>{selectedItems.length ? 'Your recommended sessions' : 'No sessions planned'}</h2>
          </div>
          <button
            type="button"
            className="add-button"
            onClick={() => {
              setNewItem((current) => ({ ...current, courseId: current.courseId || state.profile.courses[0]?.id || '', day: state.selectedDay }))
              setSheet('add')
            }}
          >
            Add
          </button>
        </div>

        <div className="agenda-list">
          {selectedItems.length === 0 ? (
            <div className="empty-agenda">
              <strong>A little breathing room.</strong>
              <p>Add personal study time or move a recommendation here when you are ready.</p>
            </div>
          ) : (
            selectedItems.map((item) => (
              <article className={`plan-item ${item.status}`} key={item.id}>
                <div className="item-time">{formatTime(item.time)}</div>
                <button className="item-content" type="button" onClick={() => openActions(item)}>
                  <div className="item-course-row">
                    <span className={`activity-pill ${item.activity}`}>{formatActivity(item.activity)}</span>
                    <span>{item.duration} min</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.topic}</p>
                  <small>{item.status === 'completed' ? 'Completed by you' : item.status === 'skipped' ? 'Skipped for now' : item.reason}</small>
                </button>
                <button
                  type="button"
                  className={item.status === 'completed' ? 'complete-button is-done' : 'complete-button'}
                  aria-label={item.status === 'completed' ? 'Mark as incomplete' : `Mark ${item.title} complete`}
                  onClick={() => updateItem(item.id, { status: item.status === 'completed' ? 'scheduled' : 'completed' })}
                >
                  {item.status === 'completed' ? 'Done' : 'Complete'}
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <footer className="planner-footer">
        <span>Recommended, not required.</span>
        <span>You stay in control.</span>
      </footer>

      {sheet && <div className="sheet-backdrop" onClick={() => setSheet(null)} />}

      {sheet === 'actions' && activeItem && (
        <section className="bottom-sheet" aria-label="Study session actions">
          <div className="sheet-handle" />
          <div className="sheet-title-row">
            <div>
              <span className="eyebrow">STUDY SESSION</span>
              <h2>{activeItem.title}</h2>
            </div>
            <button type="button" className="close-sheet" onClick={() => setSheet(null)} aria-label="Close actions">×</button>
          </div>
          <button
            className="sheet-action primary-sheet-action"
            type="button"
            onClick={() => {
              updateItem(activeItem.id, { status: activeItem.status === 'completed' ? 'scheduled' : 'completed' })
              setSheet(null)
            }}
          >
            {activeItem.status === 'completed' ? 'Mark as not complete' : 'Mark complete'}
          </button>
          <button className="sheet-action" type="button" onClick={moveToNextSlot}>Move to next study day</button>
          <button className="sheet-action" type="button" onClick={() => setSheet('reschedule')}>Reschedule</button>
          <button
            className="sheet-action"
            type="button"
            onClick={() => {
              updateItem(activeItem.id, { status: activeItem.status === 'skipped' ? 'scheduled' : 'skipped' })
              setSheet(null)
            }}
          >
            {activeItem.status === 'skipped' ? 'Put back in my plan' : 'Skip for now'}
          </button>
        </section>
      )}

      {sheet === 'reschedule' && activeItem && (
        <section className="bottom-sheet" aria-label="Reschedule study session">
          <div className="sheet-handle" />
          <div className="sheet-title-row">
            <div>
              <span className="eyebrow">RESCHEDULE</span>
              <h2>Find a better time.</h2>
            </div>
            <button type="button" className="close-sheet" onClick={() => setSheet('actions')} aria-label="Back to actions">‹</button>
          </div>
          <div className="reschedule-days">
            {weekdayOrder.filter((day) => state.profile.studyDays.includes(day)).map((day) => (
              <button
                key={day}
                type="button"
                className={rescheduleDay === day ? 'reschedule-day is-selected' : 'reschedule-day'}
                onClick={() => setRescheduleDay(day)}
              >
                <span>{weekdayLabels[day].short}</span>
                <strong>{getDateForWeekday(day).getDate()}</strong>
              </button>
            ))}
          </div>
          <label className="field-label" htmlFor="reschedule-time">Start time</label>
          <input id="reschedule-time" className="text-input" type="time" value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} />
          <button className="primary-button full-width" type="button" onClick={rescheduleItem}>Save new time</button>
        </section>
      )}

      {sheet === 'add' && (
        <section className="bottom-sheet" aria-label="Add study session">
          <div className="sheet-handle" />
          <div className="sheet-title-row">
            <div>
              <span className="eyebrow">YOUR PLAN</span>
              <h2>Add study time.</h2>
            </div>
            <button type="button" className="close-sheet" onClick={() => setSheet(null)} aria-label="Close add session">×</button>
          </div>
          <label className="field-label" htmlFor="item-title">What do you want to do?</label>
          <input id="item-title" className="text-input" value={newItem.title} onChange={(event) => setNewItem((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Review lecture notes" />
          <label className="field-label" htmlFor="item-course">Course</label>
          <select id="item-course" className="text-input" value={newItem.courseId} onChange={(event) => setNewItem((current) => ({ ...current, courseId: event.target.value }))}>
            <option value="">Personal study</option>
            {state.profile.courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
          <label className="field-label" htmlFor="item-topic">Topic or note</label>
          <input id="item-topic" className="text-input" value={newItem.topic} onChange={(event) => setNewItem((current) => ({ ...current, topic: event.target.value }))} placeholder="Optional" />
          <div className="add-row">
            <label>
              <span className="field-label">Day</span>
              <select className="text-input" value={newItem.day} onChange={(event) => setNewItem((current) => ({ ...current, day: Number(event.target.value) }))}>
                {weekdayOrder.map((day) => <option key={day} value={day}>{weekdayLabels[day].long}</option>)}
              </select>
            </label>
            <label>
              <span className="field-label">Minutes</span>
              <select className="text-input" value={newItem.duration} onChange={(event) => setNewItem((current) => ({ ...current, duration: Number(event.target.value) }))}>
                {[30, 45, 60, 90].map((duration) => <option key={duration} value={duration}>{duration} min</option>)}
              </select>
            </label>
          </div>
          <button className="primary-button full-width" type="button" disabled={!newItem.title.trim()} onClick={addPlanItem}>Add to my plan</button>
        </section>
      )}
    </main>
  )
}

export default App
