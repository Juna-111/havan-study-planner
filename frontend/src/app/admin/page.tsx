'use client'

import { useState } from 'react'
import AdminGuard from '@/features/admin/AdminGuard'\nimport AdminOverview from '@/features/admin/AdminOverview'
import AdminShell, { type AdminMode } from '@/features/admin/AdminShell'
import AcademicSetupScreen from '@/features/admin/AcademicSetupScreen'
import MappingScreen from '@/features/admin/MappingScreen'
import ContentScreen from '@/features/admin/ContentScreen'
import ImportScreen from '@/features/admin/ImportScreen'
import QualityScreen from '@/features/admin/QualityScreen'

export default function AdminScreen() {
  const [mode, setMode] = useState<AdminMode>('overview')

  const screen = {
    academic: <AcademicSetupScreen />,
    mapping: <MappingScreen />,
    content: <ContentScreen />,
    import: <ImportScreen />,
    quality: <QualityScreen />,
  }[mode]

  return (
    <AdminGuard>
      <AdminShell mode={mode} onMode={setMode}>
        {screen}
      </AdminShell>
    </AdminGuard>
  )
}
