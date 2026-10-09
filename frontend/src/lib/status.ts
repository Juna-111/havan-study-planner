export type StatusTone = 'neutral' | 'info' | 'warn' | 'danger' | 'success'

export type StatusValue =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'SKIPPED'
  | 'NOT_STARTED'
  | 'COMPLETED'
  | 'UNKNOWN'
  | 'READY'
  | 'ON_TRACK'
  | 'TIGHT'
  | 'URGENT'
  | 'PAST'

export type StatusMeta = {
  status: StatusValue
  label: string
  tone: StatusTone
  ariaLabel: string
}

const STATUS_META: Record<StatusValue, StatusMeta> = {
  PLANNED: {
    status: 'PLANNED',
    label: 'Planned',
    tone: 'danger',
    ariaLabel: 'Planned status',
  },
  IN_PROGRESS: {
    status: 'IN_PROGRESS',
    label: 'In progress',
    tone: 'warn',
    ariaLabel: 'In progress status',
  },
  DONE: {
    status: 'DONE',
    label: 'Completed',
    tone: 'success',
    ariaLabel: 'Completed status',
  },
  SKIPPED: {
    status: 'SKIPPED',
    label: 'Skipped',
    tone: 'neutral',
    ariaLabel: 'Skipped status',
  },
  NOT_STARTED: {
    status: 'NOT_STARTED',
    label: 'Planned',
    tone: 'danger',
    ariaLabel: 'Planned status',
  },
  COMPLETED: {
    status: 'COMPLETED',
    label: 'Completed',
    tone: 'success',
    ariaLabel: 'Completed status',
  },
  READY: {
    status: 'READY',
    label: 'Ready',
    tone: 'success',
    ariaLabel: 'Ready status',
  },
  ON_TRACK: {
    status: 'ON_TRACK',
    label: 'On track',
    tone: 'warn',
    ariaLabel: 'On track status',
  },
  TIGHT: {
    status: 'TIGHT',
    label: 'Tight',
    tone: 'warn',
    ariaLabel: 'Tight status',
  },
  URGENT: {
    status: 'URGENT',
    label: 'Urgent',
    tone: 'danger',
    ariaLabel: 'Urgent status',
  },
  PAST: {
    status: 'PAST',
    label: 'Past',
    tone: 'neutral',
    ariaLabel: 'Past exam status',
  },
  UNKNOWN: {
    status: 'UNKNOWN',
    label: 'Unknown',
    tone: 'neutral',
    ariaLabel: 'Unknown status',
  },
}

export function normalizeStatus(value: unknown): StatusValue {
  const key = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '_')
  if (key === 'NOT_STARTED') return 'PLANNED'
  if (key === 'INPROGRESS' || key === 'IN_PROGRESS') return 'IN_PROGRESS'
  if (key === 'COMPLETED' || key === 'SUCCESS' || key === 'FINISHED') return 'DONE'
  if (key === 'READY') return 'READY'
  if (key === 'ON_TRACK') return 'ON_TRACK'
  if (key === 'TIGHT') return 'TIGHT'
  if (key === 'URGENT') return 'URGENT'
  if (key === 'PAST') return 'PAST'
  if (key === 'ACTIVE') return 'IN_PROGRESS'
  if (key === 'PENDING' || key === 'UPCOMING') return 'PLANNED'
  if (key in STATUS_META) return key as StatusValue
  return 'UNKNOWN'
}

export function getStatusMeta(value: unknown): StatusMeta {
  const status = normalizeStatus(value)
  return STATUS_META[status] ?? STATUS_META.UNKNOWN
}
