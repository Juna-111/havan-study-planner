import { apiFetch, ApiError } from '@/lib/api'

export type HavanPlanMode = 'today' | 'week' | 'month'
export type HavanPlanInput = {
  mode: HavanPlanMode
  horizon_days: number
  topic_ids: number[]
  study_days: number[]
  hours_per_day: Record<number, number>
  topic_estimates?: Record<number, number>
}
export type HavanPlanTask = {
  id: number | null
  course_id: number
  course_code: string
  course_name: string
  chapter_name: string
  topic_id: number
  topic_name: string
  planned_date: string
  minutes: number
  important_points?: string | null
  academy_video_url?: string | null
  academy_notes_url?: string | null
  academy_questions_url?: string | null
  freshman_question_count?: number | null
  promotions: { id: number; platform_name: string; description?: string | null; button_text: string; url: string; status: string }[]
  status: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED'
}
export type HavanPlan = {
  id: number | null
  student_id: number
  mode: HavanPlanMode
  horizon_days: number
  study_days: number[]
  hours_per_day: Record<number, number>
  total_minutes: number
  tasks: HavanPlanTask[]
  warnings: { code: string; severity: 'info' | 'warn' | 'danger'; message: string; fix?: Record<string, string> }[]
  unplaced: { topic_id: number; topic_name: string; minutes: number; reason_code: string }[]
}

export const previewHavanPlan = (input: HavanPlanInput) =>
  apiFetch<HavanPlan>('/havan-planner/me/preview', { method: 'POST', body: JSON.stringify(input) })

export const createHavanPlan = async (input: HavanPlanInput) => {
  const plan = await apiFetch<HavanPlan>('/havan-planner/me/plans', { method: 'POST', body: JSON.stringify(input) })
  if (!plan.id) throw new ApiError(500, 'Havan did not confirm that your plan was saved.')
  return plan
}

export const getLatestHavanPlan = async () => {
  try {
    return await apiFetch<HavanPlan>('/havan-planner/me/latest')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export const havanTaskAction = (
  planId: number,
  taskId: number,
  action: 'START' | 'COMPLETE',
  actualMinutes?: number,
) =>
  apiFetch<HavanPlan>(`/havan-planner/me/plans/${planId}/tasks/${taskId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ action, ...(actualMinutes === undefined ? {} : { actual_minutes: actualMinutes }) }),
  })
