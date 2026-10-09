'use client'

import { useState } from 'react'
import AdminGuard from '@/features/admin/AdminGuard'
import AdminOverview from '@/features/admin/AdminOverview'
import AdminShell, { type AdminMode } from '@/features/admin/AdminShell'
import CatalogWorkspace, { type CatalogSection } from '@/features/admin/CatalogWorkspace'
import ContentWorkspace, { type ContentSection } from '@/features/admin/ContentWorkspace'
import ReviewWorkspace from '@/features/admin/ReviewWorkspace'

export default function AdminScreen() {
  const [mode, setMode] = useState<AdminMode>('overview')
  const [catalogSection, setCatalogSection] = useState<CatalogSection>('path')
  const [contentSection, setContentSection] = useState<ContentSection>('registry')

  function openReviewedArea(nextMode: 'catalog' | 'content', section?: CatalogSection | ContentSection) {
    if (nextMode === 'catalog') setCatalogSection((section as CatalogSection | undefined) ?? 'path')
    else setContentSection((section as ContentSection | undefined) ?? 'registry')
    setMode(nextMode)
  }

  const screen = {
    overview: <AdminOverview onMode={setMode} />,
    catalog: <CatalogWorkspace initialSection={catalogSection} />,
    content: <ContentWorkspace initialSection={contentSection} />,
    review: <ReviewWorkspace onMode={openReviewedArea} />,
  }[mode]

  return (
    <AdminGuard>
      <AdminShell mode={mode} onMode={setMode}>
        {screen}
      </AdminShell>
    </AdminGuard>
  )
}
