'use client'

import {useEffect, useMemo, useState} from 'react'
import {apiFetch} from '../../lib/api'

type University={id:number;name:string;code:string}
type Curriculum={id:number;university_id:number;name:string;version:string;academic_year?:string|null;status:string}
type Template={id:number;code:string;name:string;version:string;academic_year?:string|null;status:string}
type Mapping={id:number;curriculum_id:number;curriculum_name:string;curriculum_version:string;university_id:number;university_name:string;template_id:number;template_code:string;template_name:string;template_version:string;template_academic_year?:string|null;status:string;notes?:string|null}

export default function FreshmanMappingWorkspace(){
  const [universities,setUniversities]=useState<University[]>([])
  const [curriculums,setCurriculums]=useState<Curriculum[]>([])
  const [templates,setTemplates]=useState<Template[]>([])
  const [mappings,setMappings]=useState<Mapping[]>([])
  const [universityId,setUniversityId]=useState('')
  const [curriculumId,setCurriculumId]=useState('')
  const [templateId,setTemplateId]=useState('')
  const [status,setStatus]=useState('DRAFT')
  const [notes,setNotes]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  async function load(){
    setError('')
    try{
      const [u,c,t,m]=await Promise.all([
        apiFetch<{items:University[]}>('/universities?page=1&page_size=100'),
        apiFetch<{items:Curriculum[]}>('/curriculums?page=1&page_size=100'),
        apiFetch<Template[]>('/freshman-templates'),
        apiFetch<Mapping[]>('/freshman-mappings')
      ])
      setUniversities(u.items)
      setCurriculums(c.items)
      setTemplates(t)
      setMappings(m)
      if(!universityId && u.items[0])setUniversityId(String(u.items[0].id))
    }catch(err){setError(err instanceof Error?err.message:'Could not load Freshman curriculum mappings.')}
  }

  useEffect(()=>{load()},[])

  const universityCurriculums=useMemo(
    ()=>curriculums.filter(item=>String(item.university_id)===universityId),
    [curriculums,universityId]
  )

  const mappedCurriculumIds=useMemo(()=>new Set(mappings.map(item=>item.curriculum_id)),[mappings])

  useEffect(()=>{
    if(!universityCurriculums.some(item=>String(item.id)===curriculumId)){
      setCurriculumId(universityCurriculums.find(item=>!mappedCurriculumIds.has(item.id))?.id.toString()??universityCurriculums[0]?.id.toString()??'')
    }
  },[universityCurriculums,curriculumId,mappedCurriculumIds])

  useEffect(()=>{
    if(!templates.some(item=>String(item.id)===templateId)){
      setTemplateId(templates.find(item=>item.status==='ACTIVE')?.id.toString()??templates[0]?.id.toString()??'')
    }
  },[templates,templateId])

  async function createMapping(){
    if(!curriculumId||!templateId){
      setError('Select a university curriculum and a national Freshman template first.')
      return
    }
    setBusy(true);setError('');setMessage('')
    try{
      const created=await apiFetch<Mapping>('/freshman-mappings',{
        method:'POST',
        body:JSON.stringify({
          curriculum_id:Number(curriculumId),
          template_id:Number(templateId),
          status,
          notes:notes||null
        })
      })
      setMappings(items=>[created,...items])
      setMessage('University curriculum mapped to the national Freshman template.')
      setNotes('')
      const next=universityCurriculums.find(item=>!mappedCurriculumIds.has(item.id)&&item.id!==created.curriculum_id)
      setCurriculumId(next?.id.toString()??'')
    }catch(err){setError(err instanceof Error?err.message:'Could not create the mapping.')}
    finally{setBusy(false)}
  }

  async function removeMapping(id:number){
    setBusy(true);setError('');setMessage('')
    try{
      await apiFetch(`/freshman-mappings/${id}`,{method:'DELETE'})
      setMappings(items=>items.filter(item=>item.id!==id))
      setMessage('Freshman mapping removed. The national template and university curriculum remain unchanged.')
    }catch(err){setError(err instanceof Error?err.message:'Could not remove the mapping.')}
    finally{setBusy(false)}
  }

  return <div className='workspacePage'>
    <header className='workspaceHeader'>
      <div>
        <span>HAVAN ACADEMIC MAPPING</span>
        <h1>University Freshman mapping</h1>
        <p>Connect a university curriculum version to a national Freshman template. The national course hierarchy is referenced, never duplicated.</p>
      </div>
    </header>

    {message&&<div className='notice workspaceNotice'>{message}</div>}
    {error&&<div className='alert workspaceNotice'>{error}<button onClick={()=>setError('')}>×</button></div>}

    <section className='workspaceGrid'>
      <div className='workspaceCard'>
        <h3>1. Select the university curriculum</h3>
        <p className='muted'>A curriculum version can have one Freshman mapping.</p>
        <label><span>University</span><select value={universityId} onChange={e=>setUniversityId(e.target.value)}><option value=''>Select university…</option>{universities.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label><span>Curriculum version</span><select value={curriculumId} onChange={e=>setCurriculumId(e.target.value)}><option value=''>Select curriculum…</option>{universityCurriculums.map(item=><option key={item.id} value={item.id} disabled={mappedCurriculumIds.has(item.id)}>{item.name} · v{item.version}{item.status!=='ACTIVE'?' · '+item.status:''}{mappedCurriculumIds.has(item.id)?' · MAPPED':''}</option>)}</select></label>
        {curriculumId&&<div className='workspaceMeta'>This mapping belongs to curriculum ID #{curriculumId}. Its university courses remain separate from the national Freshman registry.</div>}
      </div>

      <div className='workspaceCard'>
        <h3>2. Attach the national baseline</h3>
        <p className='muted'>Choose the versioned Freshman template that this curriculum follows.</p>
        <label><span>National Freshman template</span><select value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value=''>Select template…</option>{templates.map(item=><option key={item.id} value={item.id}>{item.code} · v{item.version} · {item.status}</option>)}</select></label>
        <label><span>Mapping status</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value='DRAFT'>Draft</option><option value='ACTIVE'>Active</option><option value='ARCHIVED'>Archived</option></select></label>
        <label><span>Notes</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder='Optional university-specific mapping note…'/></label>
        <button className='workspacePrimary' disabled={busy||!curriculumId||!templateId} onClick={createMapping}>{busy?'Saving…':'Create mapping'}</button>
      </div>
    </section>

    <section className='workspacePanel'>
      <header><div><span>UNIVERSITY → NATIONAL REFERENCE</span><h2>Current Freshman mappings</h2></div><strong>{mappings.length} mappings</strong></header>
      {mappings.length===0?<div className='empty'><h3>No Freshman mappings yet</h3><p>Create the first university-to-national curriculum mapping.</p></div>:
      <div className='workspaceMappingList'>{mappings.map(item=><article className='workspaceMapping' key={item.id}>
        <div><small>{item.university_name}</small><h3>{item.curriculum_name} · v{item.curriculum_version}</h3><p>Uses <b>{item.template_code} · v{item.template_version}</b> · {item.template_name}</p></div>
        <div className='workspaceMappingMeta'><span className={item.status==='ACTIVE'?'workspaceStatusActive':'workspaceStatus'}>{item.status}</span><button className='danger' disabled={busy} onClick={()=>removeMapping(item.id)}>Remove mapping</button></div>
      </article>)}</div>}
    </section>
  </div>
}
