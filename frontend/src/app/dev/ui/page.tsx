'use client'

import { useState } from 'react'
import {
  Banner,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  Chip,
  DateField,
  EmptyState,
  ErrorState,
  IconButton,
  NumberStepper,
  ProgressBar,
  ProgressRing,
  Segmented,
  Select,
  Skeleton,
  Toast,
  TreeSelect,
} from '@/components/ui'

export default function Ui() {
  if (process.env.NEXT_PUBLIC_ENABLE_UI_DEV !== 'true') return null

  const [selected, setSelected] = useState(new Set<string>())
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState(false)
  const courses = [{
    id: 'math',
    name: 'Mathematics',
    chapters: [{
      id: 'c1',
      name: 'Functions',
      topics: [
        { id: 't1', name: 'Domain and range', minutes: 30 },
        { id: 't2', name: 'Graphs', minutes: 45 },
      ],
    }],
  }]

  return (
    <main className="ui-review">
      <h1>Havan UI review</h1>
      <p className="ui-review-note">Temporary review route. Enable NEXT_PUBLIC_ENABLE_UI_DEV only for development.</p>
      <Card padding="lg">
        <div className="ui-review-stack">
          <div className="ui-review-inline">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <IconButton aria-label="Close">×</IconButton>
          <div className="ui-review-inline">
            <Chip>Neutral</Chip>
            <Chip tone="info">Info</Chip>
            <Chip tone="success">Success</Chip>
            <Chip tone="warn">Warn</Chip>
            <Chip tone="danger">Danger</Chip>
          </div>
          <Segmented options={['Today', 'Week', 'Month'] as const} value="Today" onChange={() => {}} />
          <Select label="Course" value="math" onChange={() => {}} options={[{ value: 'math', label: 'Mathematics' }]} />
          <DateField label="Exam date" value="2026-10-20" onChange={() => {}} />
          <NumberStepper label="Hours per day" value={3} onChange={() => {}} />
          <Checkbox label="Study on Sunday" checked onChange={() => {}} />
          <ProgressBar value={68} />
          <ProgressRing value={68} />
          <Banner message="Your plan is ready to review." />
          <Skeleton height={24} />
          <EmptyState title="No tasks today" hint="Your next study session will appear here." action={<Button>Build a plan</Button>} />
          <ErrorState onRetry={() => {}} />
          <TreeSelect courses={courses} selected={selected} onChange={setSelected} />
          <Button onClick={() => setOpen(true)}>Open bottom sheet</Button>
          <Button variant="secondary" onClick={() => setToast(true)}>Show toast</Button>
        </div>
      </Card>
      <BottomSheet open={open} title="Review action" onClose={() => setOpen(false)}>
        <p className="ui-review-note">Focused actions stay clear and reversible.</p>
      </BottomSheet>
      {toast && <Toast message="Saved." onDismiss={() => setToast(false)} />}
    </main>
  )
}
