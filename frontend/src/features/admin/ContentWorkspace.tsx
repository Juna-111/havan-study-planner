'use client'

import { useState } from 'react'
import CourseRegistryScreen from './CourseRegistryScreen'
import ContentScreen from './ContentScreen'
import ImportScreen from './ImportScreen'
import WorkspaceTabs, { type WorkspaceTab } from './WorkspaceTabs'
import styles from './admin.module.css'

export type ContentSection = 'registry' | 'topics' | 'import'
type Section = ContentSection
const tabs: readonly WorkspaceTab<Section>[] = [
  { id: 'registry', label: 'Course registry', hint: 'Canonical course records' },
  { id: 'topics', label: 'Chapters and topics', hint: 'Learning content by course' },
  { id: 'import', label: 'Update content', hint: 'Import course files or promotions' },
]

export default function ContentWorkspace({ initialSection = 'registry' }: { initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection)
  return (
    <section className={styles.workspace}>
      <WorkspaceTabs value={section} onChange={setSection} tabs={tabs} />
      <div className={styles.workspacePanel}>
        {section === 'registry' && <CourseRegistryScreen onImport={() => setSection('import')} />}
        {section === 'topics' && <ContentScreen onImport={() => setSection('import')} />}
        {section === 'import' && <ImportScreen scope="content" />}
      </div>
    </section>
  )
}
