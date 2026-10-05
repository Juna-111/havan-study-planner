import { redirect } from 'next/navigation'

export default function HavanMonthPage() {
  redirect('/student/planner?view=month')
}
