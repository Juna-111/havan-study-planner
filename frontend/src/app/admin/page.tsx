'use client'

import { useState } from 'react'
import AdminGuard from './AdminGuard'
import AdminShell, { type AdminMode } from './AdminShell'
import MappingScreen from './MappingScreen'
import ContentScreen from './ContentScreen'
import ImportScreen from './ImportScreen'
import QualityScreen from './QualityScreen'

export default function AdminScreen() {
  const [mode, setMode] = useState<AdminMode>('mapping')

  const screen = {
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
