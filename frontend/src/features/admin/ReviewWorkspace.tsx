'use client'

import { useState } from 'react'
import QualityScreen from './QualityScreen'
import RequestManagementScreen from './RequestManagementScreen'
import WorkspaceTabs, { type WorkspaceTab } from './WorkspaceTabs'
import styles from './admin.module.css'

type Section = 'requests' | 'quality'
const tabs: readonly WorkspaceTab<Section>[] = [
  { id: 'requests', label: 'Student requests', hint: 'Review and respond' },
  { id: 'quality', label: 'Data quality', hint: 'Find issues and next steps' },
]

export default function ReviewWorkspace({ onMode }: { onMode: (mode: 'catalog' | 'content', section?: 'offerings' | 'registry' | 'topics' | 'path') => void }) {
  const [section, setSection] = useState<Section>('requests')
  return (
    <section className={styles.workspace}>
      <WorkspaceTabs value={section} onChange={setSection} tabs={tabs} />
      <div className={styles.workspacePanel}>
        {section === 'requests' && <RequestManagementScreen />}
        {section === 'quality' && <QualityScreen onMode={onMode} />}
      </div>
    </section>
  )
}
