import type { HavanPlanMode } from '@/lib/havanPlan'

export const modeCopy: Record<
  HavanPlanMode,
  { title: string; description: string; horizon: string }
> = {
  today: {
    title: 'Havan Today',
    description: 'Choose exactly what you want to study today. Havan allocates your available time across those topics.',
    horizon: '1 day',
  },
  week: {
    title: 'Havan Week',
    description: 'Choose the courses, chapters, and topics for your week. Havan spreads them across your available study days.',
    horizon: '7 days',
  },
  month: {
    title: 'Havan Month',
    description: 'Choose what you want to cover this month. Havan organizes your selected topics across the available study days.',
    horizon: '28 days',
  },
}
