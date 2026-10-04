'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthToken } from '../../../../lib/auth'
import './plan.css'

type Mode = 'today' | 'week' | 'month'
type PlanItem = { id: string; date: string; day: string; course: string; chapter: string; topic: string; minutes: number; importantPoints?: string[] }
type BuiltPlan = { mode: Mode; plan: PlanItem[] }

const minutesText = (minutes: number) => { const value = Math.max(0, Math.round(minutes)); if (value < 60) return value + ' min'; const h = Math.floor(value / 60); const m = value % 60; return m ? h + 'h ' + m + 'm' : h + 'h' }
const prettyDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value + 'T00:00:00'))

export default function HavanPlanPage() {
  const router = useRouter()
  const [built, setBuilt] = useState<BuiltPlan | null>(null)
  const [activeDate, setActiveDate] = useState('')
  useEffect(() => {
    if (!getAuthToken()) { router.replace('/auth'); return }
    try { const raw = window.sessionStorage.getItem('havan_built_plan'); if (!raw) { router.replace('/student/havan'); return }; const value = JSON.parse(raw) as BuiltPlan; setBuilt(value); setActiveDate(value.plan[0]?.date ?? '') } catch { router.replace('/student/havan') }
  }, [router])
  const days = useMemo(() => { if (!built) return []; const seen = new Set<string>(); return built.plan.filter((item) => { if (seen.has(item.date)) return false; seen.add(item.date); return true }) }, [built])
  const activeItems = useMemo(() => built?.plan.filter((item) => item.date === activeDate) ?? [], [built, activeDate])
  const totalMinutes = built?.plan.reduce((sum, item) => sum + item.minutes, 0) ?? 0
  if (!built) return <main className="havan-plan-shell"><div className="plan-loading">Preparing your plan…</div></main>
  return <main className="havan-plan-shell">
    <header className="plan-header"><button className="plan-brand" onClick={() => router.push('/student')}><span>H</span><strong>havan</strong></button><button className="back-builder" onClick={() => router.push('/student/havan')}>Edit plan</button></header>
    <section className="plan-hero"><span className="plan-kicker">YOUR HAVAN PLAN</span><div className="plan-title-row"><div><h1>{built.mode === 'today' ? 'Havan Today' : built.mode === 'week' ? 'Havan Week' : 'Havan Month'}</h1><p>Your selected topics, organized into clear study blocks.</p></div><div className="total-time"><strong>{minutesText(totalMinutes)}</strong><span>planned</span></div></div></section>
    {days.length > 1 && <nav className="day-strip">{days.map((day) => <button key={day.date} className={activeDate === day.date ? 'active' : ''} onClick={() => setActiveDate(day.date)}><b>{day.day}</b><span>{prettyDate(day.date)}</span></button>)}</nav>}
    <section className="plan-content"><div className="selected-day-heading"><div><span>STUDY DAY</span><h2>{activeItems[0]?.day ?? 'Your plan'}</h2></div><strong>{minutesText(activeItems.reduce((sum, item) => sum + item.minutes, 0))}</strong></div>
      <div className="plan-cards">{activeItems.map((item, index) => <article className="study-card" key={item.id}><div className="study-card-number">{String(index + 1).padStart(2, '0')}</div><div><div className="study-card-meta"><span>{item.course}</span><span>Chapter {item.chapter}</span></div><div className="study-card-title-row"><h3>{item.topic}</h3><strong>{minutesText(item.minutes)}</strong></div><div className="focus-box"><span className="focus-label">HAVAN RECOMMENDATION</span>{item.importantPoints?.length ? <ul>{item.importantPoints.map((point, i) => <li key={i}>{point}</li>)}</ul> : <p>No specific recommendation has been added for this topic yet.</p>}</div><div className="academy-card"><div className="academy-mark">H</div><div><strong>Havan Academy</strong><p>Use Havan Academy learning support for this topic when available.</p></div></div></div></article>)}</div>
    </section>
    <div className="plan-bottom-actions"><button className="secondary-action" onClick={() => router.push('/student/havan')}>Change my plan</button><button className="primary-action" onClick={() => router.push('/student')}>Back to dashboard</button></div>
  </main>
}