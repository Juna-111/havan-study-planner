'use client'

import styles from './admin.module.css'

export type WorkspaceTab<T extends string> = { id: T; label: string; hint: string }

export default function WorkspaceTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T
  onChange: (value: T) => void
  tabs: readonly WorkspaceTab<T>[]
}) {
  return (
    <nav className={styles.workspaceTabs} aria-label="Workspace sections">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          className={value === tab.id ? styles.workspaceTabActive : styles.workspaceTab}
          aria-current={value === tab.id ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          <span className={styles.workspaceTabNumber}>0{index + 1}</span>
          <span><strong>{tab.label}</strong><small>{tab.hint}</small></span>
        </button>
      ))}
    </nav>
  )
}
