export type StudyStream = 'natural' | 'social'
export type PlanMode = 'keep-up' | 'catch-up' | 'exam'
export type ActivityType = 'focus' | 'practice' | 'review' | 'buffer' | 'personal'
export type PlanItemStatus = 'scheduled' | 'completed' | 'skipped'

export interface Course {
  id: string
  name: string
  topic: string
}

export interface Assessment {
  courseId: string
  name: string
  date: string
}

export interface StudentProfile {
  university: string
  stream: StudyStream
  courses: Course[]
  assessment?: Assessment
  studyDays: number[]
  studyHours: number
}

export interface PlanItem {
  id: string
  courseId?: string
  title: string
  topic: string
  day: number
  time: string
  duration: number
  activity: ActivityType
  status: PlanItemStatus
  source: 'recommended' | 'manual'
  reason: string
}

export const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]

export const weekdayLabels: Record<number, { short: string; long: string }> = {
  0: { short: 'S', long: 'Sunday' },
  1: { short: 'M', long: 'Monday' },
  2: { short: 'T', long: 'Tuesday' },
  3: { short: 'W', long: 'Wednesday' },
  4: { short: 'T', long: 'Thursday' },
  5: { short: 'F', long: 'Friday' },
  6: { short: 'S', long: 'Saturday' },
}

const activityLabels: Record<ActivityType, string> = {
  focus: 'Focus session',
  practice: 'Practice',
  review: 'Review',
  buffer: 'Study buffer',
  personal: 'Personal study',
}

const timeSlots = ['08:30', '17:30', '19:00']

export function getDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDaysUntil(date: string) {
  const target = new Date(`${date}T12:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

export function getRecommendedMode(profile: StudentProfile, plan: PlanItem[]): PlanMode {
  const daysUntilAssessment = profile.assessment ? getDaysUntil(profile.assessment.date) : null

  if (daysUntilAssessment !== null && daysUntilAssessment >= 0 && daysUntilAssessment <= 14) {
    return 'exam'
  }

  if (plan.some((item) => item.status === 'skipped')) {
    return 'catch-up'
  }

  return 'keep-up'
}

export function getModeCopy(mode: PlanMode, profile: StudentProfile) {
  if (mode === 'exam') {
    const assessment = profile.assessment
    const days = assessment ? getDaysUntil(assessment.date) : 0
    return {
      eyebrow: 'EXAM MODE RECOMMENDED',
      title: assessment ? `${assessment.name} is getting close.` : 'Protect time for your assessment.',
      body:
        days > 0
          ? `We are prioritising practice and review for the next ${days} days. You can change this anytime.`
          : 'We are prioritising practice and review. You can change this anytime.',
    }
  }

  if (mode === 'catch-up') {
    return {
      eyebrow: 'CATCH-UP MODE RECOMMENDED',
      title: 'A calm way to get back on track.',
      body: 'We saved a flexible recovery block and kept your highest-value work in view.',
    }
  }

  return {
    eyebrow: 'KEEP-UP MODE RECOMMENDED',
    title: 'A balanced week, built around you.',
    body: 'Stay with your current topics, practise actively, and leave room for life to happen.',
  }
}

export function getWeekStart() {
  const date = new Date()
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  date.setHours(0, 0, 0, 0)
  return date
}

export function getDateForWeekday(day: number) {
  const date = getWeekStart()
  date.setDate(date.getDate() + ((day + 6) % 7))
  return date
}

export function formatWeekdayDate(day: number) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' }).format(
    getDateForWeekday(day),
  )
}

export function formatTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2020, 0, 1, hours, minutes),
  )
}

export function formatActivity(activity: ActivityType) {
  return activityLabels[activity]
}

export function buildPlan(profile: StudentProfile): PlanItem[] {
  const selectedDays = weekdayOrder.filter((day) => profile.studyDays.includes(day))
  const assessmentCourseId = profile.assessment?.courseId
  const orderedCourses = [...profile.courses].sort((a, b) => {
    if (a.id === assessmentCourseId) return -1
    if (b.id === assessmentCourseId) return 1
    return 0
  })
  const mode = getRecommendedMode(profile, [])
  const items: PlanItem[] = []
  const sessionsPerDay = Math.max(1, Math.min(3, Math.round(profile.studyHours)))

  selectedDays.forEach((day, dayIndex) => {
    for (let sessionIndex = 0; sessionIndex < sessionsPerDay; sessionIndex += 1) {
      const isRecoveryBlock =
        mode !== 'exam' && dayIndex === selectedDays.length - 1 && sessionIndex === sessionsPerDay - 1

      if (isRecoveryBlock) {
        items.push({
          id: `buffer-${day}-${sessionIndex}`,
          title: 'Flexible study buffer',
          topic: 'Use this for a moved task, questions, or rest',
          day,
          time: timeSlots[sessionIndex],
          duration: 35,
          activity: 'buffer',
          status: 'scheduled',
          source: 'recommended',
          reason: 'A lighter plan is more likely to survive a busy week.',
        })
        continue
      }

      const course =
        mode === 'exam' && sessionIndex === 0 && assessmentCourseId
          ? orderedCourses.find((item) => item.id === assessmentCourseId) ?? orderedCourses[0]
          : orderedCourses[(dayIndex * sessionsPerDay + sessionIndex) % orderedCourses.length]
      const activities: ActivityType[] = mode === 'exam' ? ['practice', 'review', 'focus'] : ['focus', 'practice', 'review']
      const activity = activities[sessionIndex % activities.length]
      const isAssessmentCourse = course.id === assessmentCourseId
      const reason = isAssessmentCourse
        ? 'This course has an upcoming assessment, so it gets extra practice time.'
        : activity === 'review'
          ? 'A short review helps turn recent learning into longer-term recall.'
          : 'This keeps your current topic moving without overloading the week.'

      items.push({
        id: `plan-${day}-${sessionIndex}-${course.id}`,
        courseId: course.id,
        title: `${activity === 'focus' ? 'Study' : formatActivity(activity)} ${course.name}`,
        topic: course.topic,
        day,
        time: timeSlots[sessionIndex],
        duration: activity === 'review' ? 40 : 50,
        activity,
        status: 'scheduled',
        source: 'recommended',
        reason,
      })
    }
  })

  return items
}
