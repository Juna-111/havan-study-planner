'use client'

import { useState } from 'react'
import AcademicSetupScreen from './AcademicSetupScreen'
import MappingScreen from './MappingScreen'
import ImportScreen from './ImportScreen'
import WorkspaceTabs, { type WorkspaceTab } from './WorkspaceTabs'
import styles from './admin.module.css'

export type CatalogSection = 'path' | 'offerings' | 'import'
type Section = CatalogSection
const tabs: readonly WorkspaceTab<Section>[] = [
  { id: 'path', label: 'Catalog path', hint: 'Universities and streams' },
  { id: 'offerings', label: 'Course offerings', hint: 'Semester 1 and 2' },
  { id: 'import', label: 'Update catalog', hint: 'Validate a university CSV' },
]

export default function CatalogWorkspace({ initialSection = 'path' }: { initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection)
  return (
    <section className={styles.workspace}>
      <WorkspaceTabs value={section} onChange={setSection} tabs={tabs} />
      <div className={styles.workspacePanel}>
        {section === 'path' && <AcademicSetupScreen onImport={() => setSection('import')} />}
        {section === 'offerings' && <MappingScreen />}
        {section === 'import' && <ImportScreen scope="catalog" />}
      </div>
    </section>
  )
}
