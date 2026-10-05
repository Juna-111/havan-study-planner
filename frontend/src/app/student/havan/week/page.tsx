import { redirect } from 'next/navigation'

export default function HavanWeekPage() {
  redirect('/student/planner?view=week')
}
