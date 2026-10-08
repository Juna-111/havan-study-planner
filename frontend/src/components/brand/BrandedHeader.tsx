'use client'

import { ReactNode } from 'react'
import { HavanLogo } from './HavanLogo'
import styles from '@/components/layout/layout.module.css'

interface BrandedHeaderProps {
  eyebrow?: string
  title?: ReactNode
  logoSize?: number
  action?: ReactNode
  rightContent?: ReactNode
}

export function BrandedHeader({
  eyebrow,
  title,
  logoSize = 44,
  action,
  rightContent,
}: BrandedHeaderProps) {
  return (
    <div className={styles.brandedHeader}>
      <div className={styles.brandedHeaderLeft}>
        <HavanLogo size={logoSize} variant="dark" />
        {rightContent}
      </div>
      <div className={styles.brandedHeaderCenter}>
        {eyebrow && <span className={styles.brandedHeaderEyebrow}>{eyebrow}</span>}
        {title && <span className={styles.brandedHeaderTitle}>{title}</span>}
      </div>
      <div className={styles.brandedHeaderRight}>
        {action}
      </div>
    </div>
  )
}
