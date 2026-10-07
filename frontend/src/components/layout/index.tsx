'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './layout.module.css'

/** Responsive Havan app shell and navigation primitives. */

const navigation = [
  ['/student/havan', 'Havan'],
  ['/student/havan/plan', 'Plan'],
  ['/exam-planning', 'Exam Planning'],
  ['/progress', 'Progress'],
  ['/settings', 'Settings'],
] as const

function isActivePath(pathname: string, href: string) {
  if (href === '/student/havan') return pathname === href || (pathname.startsWith(`${href}/`) && pathname !== '/student/havan/plan')
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className={styles.bottom} aria-label="Main navigation">
      {navigation.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={isActivePath(pathname, href) ? styles.active : ''}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}

export function SideNav() {
  const pathname = usePathname()

  return (
    <aside className={styles.side}>
      <div className={styles.brandGlow} aria-hidden="true" />
      <div className={styles.brandBlock}>
        <span>HAVAN</span>
        <small>Student space</small>
      </div>
      <nav aria-label="Student navigation">
        {navigation.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={isActivePath(pathname, href) ? styles.active : ''}
          >
            <span className={styles.navDot} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <div className={styles.sideFooter}>
        <span>Choose. Study. Progress.</span>
      </div>
    </aside>
  )
}

export function PageHeader({
  title,
  description,
  backHref,
  action,
}: {
  title: string
  description?: string
  backHref?: string
  action?: React.ReactNode
}) {
  return (
    <header className={styles.pageHeader}>
      {backHref && <Link href={backHref}>← Back</Link>}
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {action}
      </div>
    </header>
  )
}

export function StickyActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.sticky}>
      <div>{children}</div>
    </div>
  )
}

export function AppShell({
  children,
  header,
}: {
  children: React.ReactNode
  header?: React.ReactNode
}) {
  return (
    <div className={styles.shell}>
      <SideNav />
      <main>
        {header}
        <div className={styles.content}>{children}</div>
      </main>
      <BottomNav />
    </div>
  )
}
