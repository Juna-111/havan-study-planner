'use client'

import { StudentGate } from '@/features/student/StudentGate'
import { PlanBuilder } from '@/features/student/PlanBuilder'

export default function NewPlan() {
  return <StudentGate><PlanBuilder /></StudentGate>
}
