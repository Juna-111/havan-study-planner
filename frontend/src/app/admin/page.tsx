'use client'

import {useState} from 'react'
import './admin.css'
import FreshmanRegistryWorkspace from './FreshmanRegistryWorkspace'
import FreshmanTemplateWorkspace from './FreshmanTemplateWorkspace'
import FreshmanMappingWorkspace from './FreshmanMappingWorkspace'
import FreshmanStreamAssignmentWorkspace from './FreshmanStreamAssignmentWorkspace'
import UniversityOverrideWorkspace from './UniversityOverrideWorkspace'
import AcademicQuality from './AcademicQuality'

type Mode =
  | 'quality'
  | 'freshman'
  | 'templates'
  | 'mapping'
  | 'streamAssignments'
  | 'universityOverrides'

const navigation: Array<{mode: Mode; label: string; icon: string}> = [
  {mode: 'quality', label: 'Academic quality', icon: '✓'},
  {mode: 'freshman', label: 'Freshman registry', icon: '▣'},
  {mode: 'templates', label: 'Freshman templates', icon: '▤'},
  {mode: 'mapping', label: 'Freshman mapping', icon: '↔'},
  {mode: 'streamAssignments', label: 'Stream courses', icon: '⊞'},
  {mode: 'universityOverrides', label: 'University overrides', icon: '⚙'},
]

export default function Admin() {
  const [mode, setMode] = useState<Mode>('quality')
  const [mobileNav, setMobileNav] = useState(false)

  const selectMode = (next: Mode) => {
    setMode(next)
    setMobileNav(false)
  }

  const workspace = {
    quality: <AcademicQuality />,
    freshman: <FreshmanRegistryWorkspace />,
    templates: <FreshmanTemplateWorkspace />,
    mapping: <FreshmanMappingWorkspace />,
    streamAssignments: <FreshmanStreamAssignmentWorkspace />,
    universityOverrides: <UniversityOverrideWorkspace />,
  }[mode]

  return (
    <div className="ad">
      <button
        className="mobileMenu"
        aria-label="Open admin navigation"
        onClick={() => setMobileNav(true)}
      >
        ☰
      </button>

      {mobileNav && (
        <button
          className="mobileScrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}

      <aside className={mobileNav ? 'mobileOpen' : ''}>
        <div className="brand">
          <b>H</b>
          <strong>havan</strong>
          <small>Study Planner</small>
        </div>

        <label>ACADEMIC CONTROL</label>

        {navigation.map(item => (
          <button
            key={item.mode}
            className={mode === item.mode ? 'sel' : ''}
            onClick={() => selectMode(item.mode)}
          >
            {item.icon} {item.label}
          </button>
        ))}

        <footer>
          Havan academic workspace
          <br />
          <small>MVP</small>
        </footer>
      </aside>

      <main>{workspace}</main>
    </div>
  )
}
