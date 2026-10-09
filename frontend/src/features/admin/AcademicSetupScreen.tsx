'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type University = { id:number; name:string; code:string; status:string }
type Curriculum = { id:number; university_id:number; name:string; version:string; academic_year?:string|null; status:string }
type Stream = { id:number; curriculum_id:number; name:string; code:string; status:string }

export default function AcademicSetupScreen({ onImport }: { onImport?: () => void }) {
  const [universities,setUniversities]=useState<University[]>([])
  const [curriculums,setCurriculums]=useState<Curriculum[]>([])
  const [streams,setStreams]=useState<Stream[]>([])
  const [universityId,setUniversityId]=useState('')
  const [curriculumId,setCurriculumId]=useState('')
  const [error,setError]=useState('')

  useEffect(() => {
    Promise.all([
      apiFetch<{items:University[]}>('/universities?page=1&page_size=100'),
      apiFetch<{items:Curriculum[]}>('/curriculums?page=1&page_size=100'),
      apiFetch<{items:Stream[]}>('/streams?page=1&page_size=100'),
    ]).then(([u,c,s]) => {
      setUniversities(u.items); setCurriculums(c.items); setStreams(s.items)
      const first=u.items.find((item)=>item.status==='ACTIVE')
      if(first) setUniversityId(String(first.id))
    }).catch((value)=>setError(value instanceof Error?value.message:'Could not load academic catalog.'))
  }, [])

  const visibleCurriculums=curriculums.filter((item)=>String(item.university_id)===universityId)
  useEffect(()=>{
    const first=visibleCurriculums.find((item)=>item.status==='ACTIVE')||visibleCurriculums[0]
    setCurriculumId(first?String(first.id):'')
  },[universityId,curriculums])

  const visibleStreams=streams.filter((item)=>String(item.curriculum_id)===curriculumId)

  return (
    <section>
      <header className={styles.header}>
        <span>SETUP · ACADEMIC CATALOG</span>
        <h1>Academic catalog</h1>
        <p>Check that each university has an active curriculum and streams before reviewing its course offerings.</p>
      </header>
      {error&&<div className={styles.alert}>{error}</div>}
      <div className={styles.notice}>
        <h2>Keep the catalog in sync</h2>
        <p>University, curriculum and stream records come from the authoritative CSV. Open Update catalog to validate and apply a complete file.</p>
        {onImport && <button className={styles.primary} onClick={onImport}>Update university CSV</button>}
      </div>
      <div className={styles.selectors}>
        <label>University<select value={universityId} onChange={(e)=>setUniversityId(e.target.value)}>
          <option value="">Choose university</option>
          {universities.map((item)=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select></label>
        <label>Curriculum<select value={curriculumId} onChange={(e)=>setCurriculumId(e.target.value)}>
          <option value="">Choose curriculum</option>
          {visibleCurriculums.map((item)=><option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}
        </select></label>
      </div>
      <div className={styles.stats}>
        <div><span>Universities</span><b>{universities.length}</b></div>
        <div><span>Curricula for selection</span><b>{visibleCurriculums.length}</b></div>
        <div><span>Streams in curriculum</span><b>{visibleStreams.length}</b></div>
        <div><span>Active streams</span><b>{visibleStreams.filter((item)=>item.status==='ACTIVE').length}</b></div>
      </div>
      <div className={styles.list}>
        <div className={styles.crudHead}><div><h2>Current academic path</h2><p>Imported records exposed to student registration.</p></div></div>
        {visibleStreams.map((item)=><div className={styles.row} key={item.id}><div><b>{item.code} · {item.name}</b><small>{item.status} · Stream ID #{item.id}</small></div><span>Managed by university CSV</span></div>)}
        {!visibleStreams.length&&<div className={styles.empty}>No streams are registered for this curriculum.</div>}
      </div>
    </section>
  )
}
