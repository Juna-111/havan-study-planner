'use client'

import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

const destinations = [
  {
    href: '/plan/new?mode=today',
    title: 'Havan Today',
    label: '1 day',
    description: 'Choose what you want to study today and give each topic a clear amount of time.',
  },
  {
    href: '/plan/new?mode=week',
    title: 'Havan Week',
    label: '7 days',
    description: 'Build a focused week from the courses, chapters, and topics you choose.',
  },
  {
    href: '/plan/new?mode=month',
    title: 'Havan Month',
    label: '28 days',
    description: 'Spread your selected topics across a longer study period without losing control.',
  },
]

export default function HavanHome() {
  return (
    <AppShell>
      <div className="havan-home">
        <header className="havan-home-hero">
          <span className="app-eyebrow">HAVAN ACADEMY</span>
          <h1>Your study journey, your choice.</h1>
          <p>Choose what you want to learn. Havan helps you organize your study time.</p>
        </header>

        <section className="havan-home-intro" aria-labelledby="havan-choose-heading">
          <div>
            <span className="app-eyebrow">CHOOSE YOUR VIEW</span>
            <h2 id="havan-choose-heading">Where do you want to study?</h2>
          </div>
          <p>Start with today, plan the week, or think further ahead.</p>
        </section>

        <div className="havan-destination-grid">
          {destinations.map((destination) => (
            <a key={destination.href} href={destination.href} className="havan-destination">
              <Card padding="lg" className="havan-destination-card">
                <div className="havan-destination-top">
                  <span className="havan-destination-label">{destination.label}</span>
                  <span className="havan-destination-arrow" aria-hidden="true">→</span>
                </div>
                <h2>{destination.title}</h2>
                <p>{destination.description}</p>
                <span className="havan-destination-action">Open {destination.title}</span>
              </Card>
            </a>
          ))}
        </div>

        <section className="havan-home-note" aria-label="How Havan works">
          <strong>How Havan works</strong>
          <p>You choose the course, chapter, and topic. You decide how much time you have. Havan organizes that choice into a study plan.</p>
        </section>
      </div>
    </AppShell>
  )
}
