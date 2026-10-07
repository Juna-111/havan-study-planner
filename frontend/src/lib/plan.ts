import { ApiError, apiFetch } from '@/lib/api'

export type PlanMode = 'today' | 'week' | 'month'
export type PlanActionName = 'START' | 'COMPLETE' | 'SKIP' | 'MOVE' | 'REPEAT' | 'REMOVE' | 'ADD'
export type PlanTaskStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED'
export type PlanTask = {
  id: number
  course_id: number
  course_code: string
  course_name: string
  topic_id: number
  topic_name: string
  chapter_name: string
  planned_date: string
  minutes: number
  priority: number
  reason: string
  reason_parts: unknown[]
  kind: string
  status: PlanTaskStatus
  pinned: boolean
}
export type Plan = {
  id: number | null
  student_id: number
  mode: PlanMode
  horizon_days: number
  start_date: string
  engine_version: string
  total_minutes: number
  tasks: PlanTask[]
  readiness: unknown[]
  warnings: { code: string; severity: string; message: string; fix: Record<string, string> }[]
  unplaced: { topic_id: number; topic_name: string; course_id: number; course_name: string; minutes: number; reason_code: string }[]
  saved: boolean
}
export type PlanInput = {
  mode: PlanMode
  horizon_days: number
  topic_ids: number[]
  known_topic_ids: number[]
  study_days: string[]
  minutes_by_weekday: Record<string, number>
  hours_per_day: number
  topic_minutes?: Record<number, number>
}
export type PlanActionPayload = {
  action: PlanActionName
  target_date?: string
  target_topic_id?: number
  actual_minutes?: number
  confidence?: number
  rebuild?: boolean
}

export async function getCurrentPlan(): Promise<Plan | null> {
  try {
    return await apiFetch<Plan>('/plans/current')
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NO_ACTIVE_PLAN') return null
    throw error
  }
}

export async function savePlan(input: PlanInput): Promise<Plan> {
  const plan = await apiFetch<Plan>('/plans', { method: 'POST', body: JSON.stringify(input) })
  if (!plan.saved || !plan.id) {
    throw new ApiError(500, 'Havan did not confirm that your plan was saved. Please try again.')
  }
  return plan
}

export const previewPlan = (input: PlanInput) =>
  apiFetch<Plan>('/plans/preview', { method: 'POST', body: JSON.stringify(input) })

export const planAction = (taskId: number, payload: PlanActionPayload) =>
  apiFetch<Plan>('/plans/current/tasks/' + taskId + '/actions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
