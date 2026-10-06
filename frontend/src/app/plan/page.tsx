'use client'

import { StudentGate } from '@/features/student/StudentGate'
import PlanView from '@/features/student/PlanView'

export default function PlanPage() {
  return (
    <StudentGate>
      <PlanView />
    </StudentGate>
  )
}
