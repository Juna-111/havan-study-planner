'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './layout.module.css'
import { HavanLogo } from '@/components/brand/HavanLogo'

/** Responsive Havan app shell and navigation primitives. */

const navigation = [
  ['/student/havan', 'Home', 'home'],
  ['/student/havan/plan', 'Plan', 'plan'],
  ['/exam-planning', 'Exams', 'exam'],
  ['/progress', 'Progress', 'progress'],
  ['/settings', 'Settings', 'settings'],
] as const

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 10.5 10 4l7 6.5" /><path d="M5.5 9.5V16h9V9.5" /></>,
    plan: <><path d="M5 4h10v12H5z" /><path d="M8 8h4M8 11h4M8 14h2" /></>,
    exam: <><path d="M4 5h12v11H4z" /><path d="M7 3v4M13 3v4M4 8h12" /></>,
    progress: <><path d="M4 15V9M10 15V5M16 15v-8" /></>,
    settings: <><path d="M10 4.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" /><path d="M10 8v4M8 10h4" /></>,
  }
  return <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">{paths[name]}</svg>
}

function isActivePath(pathname: string, href: string) {
  if (href === '/student/havan') return pathname === href || (pathname.startsWith(`${href}/`) && pathname !== '/student/havan/plan')
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className={styles.bottom} aria-label="Main navigation">
      {navigation.map(([href, label, icon]) => (
        <Link
          key={href}
          href={href}
          className={isActivePath(pathname, href) ? styles.active : ''}
        >
          <NavIcon name={icon} />
          <span>{label}</span>
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
        <HavanLogo size={54} variant="light" />
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
      <div className={styles.pageHeaderContent}>
        <span className={styles.pageHeaderEyebrow}>HAVAN ACADEMY</span>
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
