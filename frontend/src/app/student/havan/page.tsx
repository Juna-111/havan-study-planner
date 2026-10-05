'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../../lib/api'
import { getAuthToken } from '../../../lib/auth'
import './home.css'

type Item = Record<string, any>
type Level = {
  title: string
  question: string
  description: string
  route: string
  tag: string
}

const LEVELS: Level[] = [
  {
    title: 'Havan Today',
    question: 'What should I study today?',
    description: 'Your immediate priorities, study time, and tasks that need attention now.',
    route: '/student/havan/today',
    tag: 'NOW',
  },
  {
    title: 'Havan Week',
    question: 'How should I organize this week?',
    description: 'Your weekly workload, course balance, planned topics, and upcoming exam pressure.',
    route: '/student/havan/week',
    tag: '7 DAYS',
  },
  {
    title: 'Havan Month',
    question: 'Where am I heading?',
    description: 'Your academic direction, chapters ahead, exam preparation, and monthly progress.',
    route: '/student/havan/month',
    tag: '28 DAYS',
  },
]

function daysUntil(value: string) {
  const target = new Date(value + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

export default function HavanHomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [account, setAccount] = useState<Item | null>(null)
  const [context, setContext] = useState<Item | null>(null)

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace('/auth')
      return
    }

    async function load() {
      try {
        const me = await apiFetch<Item>('/auth/me')
        setAccount(me)

        if (!me.student_profile_id) {
          router.replace('/student')
          return
        }

        const data = await apiFetch<Item>('/students/profiles/' + me.student_profile_id + '/context')
        setContext(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load Havan.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  const startHere = useMemo(() => {
    const progress = Array.isArray(context?.progress) ? context.progress : []
    const inProgress = progress.find((item: Item) =>
      String(item.status ?? '').toUpperCase() === 'IN_PROGRESS',
    )

    if (inProgress) {
      return {
        eyebrow: 'CONTINUE',
        title: 'Continue your current study',
        text: 'You have a topic already in progress. Havan Today is the quickest place to continue.',
        action: 'Open Havan Today',
        route: '/student/havan/today',
      }
    }

    const exams = (Array.isArray(context?.exams) ? context.exams : [])
      .map((exam: Item) => ({ exam, days: daysUntil(String(exam.exam_date ?? '')) }))
      .filter((item: Item) => Number.isFinite(item.days) && item.days >= 0)
      .sort((a: Item, b: Item) => a.days - b.days)

    if (exams[0]) {
      const exam = exams[0].exam
      const days = exams[0].days
      return {
        eyebrow: 'NEXT PRIORITY',
        title: String(exam.course_name ?? exam.course?.name ?? exam.exam_type ?? 'Upcoming exam'),
        text: days === 0
          ? 'An exam is scheduled today. Open Havan Today to see the work currently recommended.'
          : 'Your nearest exam is ' + days + ' day' + (days === 1 ? '' : 's') + ' away. Open Havan Week to see how your preparation fits together.',
        action: days === 0 ? 'Open Havan Today' : 'Open Havan Week',
        route: days === 0 ? '/student/havan/today' : '/student/havan/week',
      }
    }

    if (Array.isArray(context?.courses) && context.courses.length) {
      return {
        eyebrow: 'START HERE',
        title: 'Your academic plan starts with Today',
        text: 'Open Havan Today to see what the planner recommends from your current academic context.',
        action: 'Open Havan Today',
        route: '/student/havan/today',
      }
    }

    return {
      eyebrow: 'GET STARTED',
      title: 'Your Havan plan is not ready yet',
      text: 'Complete your student academic setup first. Havan needs your courses and academic context before it can recommend what to study.',
      action: 'Open student setup',
      route: '/student',
    }
  }, [context])

  if (loading) {
    return (
      <main className="havan-home-shell">
        <div className="havan-home-skeleton" aria-label="Loading Havan">
          <span className="skeleton-small" />
          <span className="skeleton-title" />
          <span className="skeleton-line" />
          <span className="skeleton-card" />
          <div className="skeleton-grid"><span /><span /><span /></div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="havan-home-shell">
        <section className="havan-home-error" role="alert">
          <span className="havan-home-kicker">HAVAN</span>
          <h1>Havan could not load right now.</h1>
          <p>Please try again. Your existing planner data has not been changed.</p>
          <button type="button" onClick={() => window.location.reload()}>Try again</button>
        </section>
      </main>
    )
  }

  const firstName = String(account?.name ?? context?.profile?.name ?? 'Student').trim().split(/\s+/)[0] || 'Student'

  return (
    <main className="havan-home-shell">
      <header className="havan-home-header">
        <button className="havan-home-brand" type="button" onClick={() => router.push('/student')} aria-label="Return to student dashboard">
          <span>H</span>
          <strong>havan</strong>
        </button>
        <button className="havan-home-dashboard" type="button" onClick={() => router.push('/student')}>Dashboard</button>
      </header>

      <section className="havan-home-hero">
        <span className="havan-home-kicker">HAVAN · STUDY NAVIGATION</span>
        <h1>Know what to <em>study next.</em></h1>
        <p>Havan turns your academic progress and upcoming exams into a study plan you can understand and control.</p>
        <p className="havan-home-greeting">Welcome, {firstName}.</p>
      </section>

      <section className="havan-start-card" aria-labelledby="start-title">
        <div>
          <span className="havan-home-kicker">{startHere.eyebrow}</span>
          <h2 id="start-title">{startHere.title}</h2>
          <p>{startHere.text}</p>
        </div>
        <button type="button" className="havan-home-primary" onClick={() => router.push(startHere.route)}>
          {startHere.action}
        </button>
      </section>

      <section className="havan-levels" aria-labelledby="levels-title">
        <div className="havan-section-heading">
          <span className="havan-home-kicker">CHOOSE YOUR VIEW</span>
          <h2 id="levels-title">Your Havan plan, at three useful levels.</h2>
        </div>

        <div className="havan-level-grid">
          {LEVELS.map((level, index) => (
            <article className="havan-level-card" key={level.route}>
              <div className="havan-level-top">
                <span>{level.tag}</span>
                <strong>0{index + 1}</strong>
              </div>
              <h3>{level.title}</h3>
              <p className="havan-level-question">{level.question}</p>
              <p>{level.description}</p>
              <button type="button" onClick={() => router.push(level.route)}>
                Open {level.title}
                <span aria-hidden="true">→</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="havan-home-footer-card">
        <div>
          <span className="havan-home-kicker">MORE CONTROL</span>
          <h2>Choose your own topics.</h2>
          <p>Use the existing planner setup when you want to select courses, chapters, topics, study days, and available time yourself.</p>
        </div>
        <button type="button" onClick={() => router.push('/student/havan/setup')}>Open planner setup</button>
      </section>

      <p className="havan-home-footer">Havan recommends. You remain in control.</p>
    </main>
  )
}
