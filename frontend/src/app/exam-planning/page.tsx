'use client'

import { AppShell, PageHeader } from '@/components/layout'
import { StudentGate } from '@/features/student/StudentGate'
import ExamPlanner from '@/features/student/ExamPlanner'

export default function ExamPlanningPage() {
  return (
    <StudentGate>
      <AppShell
        header={
          <PageHeader
            title="Exam Planning"
            description="A dedicated preparation workspace for each exam, separate from your Havan Study Plan."
            backHref="/student/havan"
          />
        }
      >
        <ExamPlanner />
      </AppShell>
    </StudentGate>
  )
}
