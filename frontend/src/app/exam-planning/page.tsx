'use client'

import { AppShell, PageHeader } from '@/components/layout'
import { Card } from '@/components/ui'
import { StudentGate } from '@/features/student/StudentGate'

export default function ExamPlanningPage() {
  return (
    <StudentGate>
      <AppShell
        header={
          <PageHeader
            title="Exam Planning"
            description="A separate space for preparing toward your exams."
            backHref="/student/havan"
          />
        }
      >
        <Card className="havan-exam-placeholder" padding="lg">
          <span>EXAM PLANNING</span>
          <h2>Prepare for an exam without changing how Havan Study Planning works.</h2>
          <p>
            Exam Planning will use exam dates and preparation scope as its own workflow.
            Your Havan study plan remains student-controlled and focused on the topics you choose.
          </p>
          <div>
            <strong>Coming in the Exam Planning phase</strong>
            <ul>
              <li>Upcoming exam overview</li>
              <li>Exam preparation targets</li>
              <li>Revision and practice planning</li>
              <li>Readiness tracking</li>
            </ul>
          </div>
        </Card>
      </AppShell>
    </StudentGate>
  )
}
