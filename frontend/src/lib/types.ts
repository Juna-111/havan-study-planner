export type Role = 'STUDENT' | 'ADMIN'
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface ApiErrorShape {
  detail?: string
  message?: string
}

export interface StudentProfile {
  id: number
  account_id: number | null
  client_key: string
  name: string
  university_id: number
  curriculum_id: number
  stream_id: number
  study_hours_per_day: number
  study_days: Weekday[]
  created_at: string
  updated_at: string
}

export interface AuthAccount {
  id: number
  email: string
  role: Role
  student_profile_id: number | null
}

export interface StudentCourse {
  id: number
  student_id: number
  course_id: number
  confidence: number
  status: string
  course_code: string
  course_name: string
  credit_hours: number | null
}
