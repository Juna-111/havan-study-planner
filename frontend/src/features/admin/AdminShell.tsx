'use client'

import { useState } from 'react'
import styles from './admin.module.css'

export type AdminMode = 'overview' | 'academic' | 'mapping' | 'content' | 'import' | 'quality'

const groups = [
  {
    label: 'SYSTEM',
    items: [['overview', 'Admin overview']],
  },
  {
    label: 'SETUP',
    items: [['academic', 'Academic catalog'], ['mapping', 'Course mapping']],
  },
  {
    label: 'CONTENT',
    items: [
      ['content', 'Courses, chapters & topics'],
      ['import', 'Import courses'],
    ],
  },
  {
    label: 'QUALITY',
    items: [['quality', 'Academic quality']],
  },
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

        {groups.map((group) => (
          <div className={styles.group} key={group.label}>
            <span>{group.label}</span>
            {group.items.map(([id, label]) => (
              <button
                key={id}
                className={mode === id ? styles.active : ''}
                onClick={() => {
                  onMode(id)
                  setOpen(false)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ))}

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
