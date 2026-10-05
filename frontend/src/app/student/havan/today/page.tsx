import { redirect } from 'next/navigation'

export default function HavanTodayPage() {
  redirect('/student/planner?view=today')
}
