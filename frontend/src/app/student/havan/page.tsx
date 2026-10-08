'use client'

import Link from 'next/link'
import { AppShell } from '@/components/layout'
import { HavanLogo } from '@/components/brand/HavanLogo'
import { Card } from '@/components/ui'

const destinations = [
  {
    href: '/student/havan/today',
    title: 'Havan Today',
    label: '1 day',
    description: 'Choose the exact courses, chapters, and topics you want to study today.',
  },
  {
    href: '/student/havan/week',
    title: 'Havan Week',
    label: '7 days',
    description: 'Build a focused week from the topics you choose and the time you have.',
  },
  {
    href: '/student/havan/month',
    title: 'Havan Month',
    label: '28 days',
    description: 'Organize a longer study period while keeping every topic and time allocation clear.',
  },
]

export default function HavanHome() {
  return (
    <AppShell>
      <div className="havan-home">
        <header className="havan-home-hero">
          <HavanLogo size={52} variant="dark" className="havan-home-logo" />
          <span className="app-eyebrow">HAVAN ACADEMY · STUDY PLANNER</span>
          <h1>Your study journey, your choice.</h1>
          <p>Choose what you want to learn and how much time you have. Havan organizes your choices into a clear study plan.</p>
        </header>

        <section className="havan-home-intro" aria-labelledby="havan-choose-heading">
          <div>
            <span className="app-eyebrow">YOUR PLANNING OPTIONS</span>
            <h2 id="havan-choose-heading">Where do you want to study?</h2>
          </div>
          <p>Start with today, plan the week, or organize the month.</p>
        </section>

        <div className="havan-destination-grid">
          {destinations.map((destination) => (
            <Link key={destination.href} href={destination.href} className="havan-destination">
              <Card padding="lg" className="havan-destination-card">
                <div className="havan-destination-top">
                  <span className="havan-destination-label">{destination.label}</span>
                  <span className="havan-destination-arrow" aria-hidden="true">→</span>
                </div>
                <h2>{destination.title}</h2>
                <p>{destination.description}</p>
                <span className="havan-destination-action">Open {destination.title}</span>
              </Card>
            </Link>
          ))}
        </div>

        <section className="havan-home-note" aria-label="How Havan works">
          <strong>How Havan works</strong>
          <p>You choose the course, chapter, and topic. You decide how much time you have. Havan organizes those choices into a study plan, then shows the important points available for each selected topic.</p>
        </section>
      </div>
    </AppShell>
  )
}
