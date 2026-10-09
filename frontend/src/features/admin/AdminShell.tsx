'use client'

import { useState } from 'react'
import styles from './admin.module.css'

export type AdminMode = 'overview' | 'catalog' | 'content' | 'review'

const items = [
  ['overview', 'Overview', 'Your workspace at a glance'],
  ['catalog', 'Academic catalog', 'Universities, streams and courses'],
  ['content', 'Course content', 'Registry, chapters and topics'],
  ['review', 'Review', 'Requests and data quality'],
] as const

export default function AdminShell({
  mode,
  onMode,
  children,
}: {
  mode: AdminMode
  onMode: (mode: AdminMode) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.shell}>
      {open && (
        <button
          className={styles.scrim}
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={open ? styles.sidebarOpen : styles.sidebar}>
        <div className={styles.brand}>
          <b>H</b>
          <div>
            <strong>havan</strong>
            <small>Academic admin</small>
          </div>
        </div>

        <nav aria-label="Admin navigation">
          <div className={styles.group}>
            <span>WORKSPACES</span>
            {items.map(([id, label, hint], index) => (
              <button
                key={id}
                className={mode === id ? styles.active : ''}
                aria-current={mode === id ? 'page' : undefined}
                onClick={() => {
                  onMode(id)
                  setOpen(false)
                }}
              >
                <span className={styles.navItem}>
                  <span className={styles.navNumber}>0{index + 1}</span>
                  <span><strong>{label}</strong><small>{hint}</small></span>
                </span>
              </button>
            ))}
          </div>
        </nav>

        <a href="/home" className={styles.homeLink}>
          Open student home ↗
        </a>
      </aside>

      <main className={styles.main}>
        <button
          className={styles.menu}
          onClick={() => setOpen(true)}
          aria-label="Open admin navigation"
        >
          ☰
        </button>
        {children}
      </main>
    </div>
  )
}
