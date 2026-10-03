'use client'

import {useState} from 'react'
import {apiFetch} from '../../lib/api'

type CatalogItem={
  topic_identity:string
  course_code:string
  course_name:string
  registry_key:string
  content_version:string
  chapter_name:string
  chapter_order:number
  topic_name:string
  topic_order:number
  difficulty:number
  estimated_study_minutes:number
  exam_importance:number
  conceptual_importance:number
}

type Preview={
  source_topic_identity:string
  target_topic_identity:string
  relationship_type:string
  strength:number
  confidence:number
  notes:string|null
  source_topic_id:number|null
  target_topic_id:number|null
  source_course_code:string|null
  target_course_code:string|null
  source_topic_name:string|null
  target_topic_name:string|null
  status:'READY'|'EXISTING'|'ERROR'
  message:string|null
}

const example=JSON.stringify({
  candidates:[{
    source_topic_identity:'FRESHMAN:PHY101:1.0::measurement::physical quantities',
    target_topic_identity:'FRESHMAN:PHY101:1.0::vectors::scalars and vectors',
    relationship_type:'prerequisite',
    strength:0.9,
    confidence:0.96,
    notes:'Understanding quantities supports later vector measurement.'
  }]
},null,2)

export default function TopicRelationshipAIWorkspace(){
  const [catalog,setCatalog]=useState<CatalogItem[]>([])
  const [candidateText,setCandidateText]=useState(example)
  const [preview,setPreview]=useState<Preview[]>([])
  const [counts,setCounts]=useState({valid:0,warnings:0,errors:0})
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  async function loadCatalog(){
    setBusy(true);setError('');setMessage('')
    try{
      const data=await apiFetch<{count:number;items:CatalogItem[]}>('/topic-relationship-candidates/catalog')
      setCatalog(data.items)
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
      const url=URL.createObjectURL(blob)
      const link=document.createElement('a')
      link.href=url
      link.download='havan-topic-catalog.json'
      link.click()
      URL.revokeObjectURL(url)
      setMessage(data.count+' active Havan topics exported. Give this catalog to the AI relationship generator.')
    }catch(err){
      setError(err instanceof Error?err.message:'Could not load the Havan topic catalog.')
    }finally{setBusy(false)}
  }

  function parseCandidates(){
    try{
      const parsed=JSON.parse(candidateText)
      if(!parsed||!Array.isArray(parsed.candidates))throw new Error('JSON must contain a candidates array.')
      return parsed
    }catch(err){
      throw new Error(err instanceof Error?err.message:'Invalid candidate JSON.')
    }
  }

  async function previewCandidates(){
    setBusy(true);setError('');setMessage('')
    try{
      const payload=parseCandidates()
      const data=await apiFetch<{valid_count:number;warning_count:number;error_count:number;items:Preview[]}>(
        '/topic-relationship-candidates/preview',
        {method:'POST',body:JSON.stringify(payload)}
      )
      setPreview(data.items)
      setCounts({valid:data.valid_count,warnings:data.warning_count,errors:data.error_count})
      setMessage(data.error_count?'Fix the highlighted candidate errors before importing.':'Every candidate has been resolved against the current Havan database.')
    }catch(err){
      setError(err instanceof Error?err.message:'Could not validate candidate JSON.')
      setPreview([])
    }finally{setBusy(false)}
  }

  async function commitCandidates(){
    if(!preview.length||counts.errors)return
    setBusy(true);setError('');setMessage('')
    try{
      const payload=parseCandidates()
      const data=await apiFetch<{created:number;skipped_existing:number}>(
        '/topic-relationship-candidates/commit',
        {method:'POST',body:JSON.stringify(payload)}
      )
      setMessage(data.created+' relationship'+(data.created===1?'':'s')+' saved. '+data.skipped_existing+' existing relationship'+(data.skipped_existing===1?' was':'s were')+' skipped.')
      setPreview([])
      setCounts({valid:0,warnings:0,errors:0})
    }catch(err){
      setError(err instanceof Error?err.message:'Could not save candidate relationships.')
    }finally{setBusy(false)}
  }

  return <div className='relationshipAIPage'>
    <header className='relationshipAIHeader'>
      <span>HAVAN RELATIONSHIP INTELLIGENCE</span>
      <h1>AI relationship pipeline</h1>
      <p>AI proposes academic relationships. Havan owns identity resolution, database IDs, validation, preview, and final persistence.</p>
    </header>

    {message&&<div className='notice relationshipNotice'>{message}</div>}
    {error&&<div className='alert relationshipNotice'>{error}</div>}

    <div className='relationshipAIBanner'>
      <div><b>AI never receives database authority.</b><span>The catalog gives the AI stable academic identities. Havan resolves those identities to the current <code>topics.id</code> only during validation.</span></div>
      <strong>IDENTITY → RESOLVE → REVIEW → SAVE</strong>
    </div>

    <div className='relationshipAIGrid'>
      <section className='relationshipAICard'>
        <span>STEP 01</span>
        <h2>Export Havan Topic Catalog</h2>
        <p>Generate the current academic catalog for the AI. Database-generated Topic IDs are not used as AI references.</p>
        <button className='workspacePrimary' disabled={busy} onClick={loadCatalog}>{busy?'Working…':'Download AI catalog'}</button>
        {catalog.length>0&&<div className='relationshipCatalogStats'><b>{catalog.length}</b><span>active topics loaded in this workspace</span></div>}
      </section>

      <section className='relationshipAICard'>
        <span>STEP 02</span>
        <h2>Paste AI candidates</h2>
        <p>AI returns stable academic identities, relationship strength, confidence, and an optional reason.</p>
        <textarea className='relationshipCandidateBox' value={candidateText} onChange={e=>setCandidateText(e.target.value)} spellCheck={false}/>
        <button className='workspacePrimary' disabled={busy} onClick={previewCandidates}>{busy?'Validating…':'Resolve and preview'}</button>
      </section>
    </div>

    {preview.length>0&&<section className='relationshipAIPreview'>
      <header><div><span>STEP 03</span><h2>Havan validation preview</h2></div><strong>{counts.valid} ready · {counts.warnings} existing · {counts.errors} errors</strong></header>
      <div className='relationshipAIList'>
        {preview.map((item,index)=><article key={index} className={'relationshipAIItem '+item.status.toLowerCase()}>
          <div className='relationshipAIItemTop'><b>{item.relationship_type}</b><span>strength {item.strength} · AI confidence {item.confidence}</span><strong>{item.status}</strong></div>
          <div className='relationshipResolved'>
            <div><small>SOURCE</small><b>{item.source_course_code}:{item.source_topic_id ?? 'unresolved'}</b><span>{item.source_topic_name||item.source_topic_identity}</span></div>
            <em>→</em>
            <div><small>TARGET</small><b>{item.target_course_code}:{item.target_topic_id ?? 'unresolved'}</b><span>{item.target_topic_name||item.target_topic_identity}</span></div>
          </div>
          {item.message&&<p>{item.message}</p>}
        </article>)}
      </div>
      <button className='primary relationshipSaveButton' disabled={busy||counts.errors>0} onClick={commitCandidates}>
        {busy?'Saving…':'Approve and save resolved relationships'}
      </button>
    </section>}

    <section className='relationshipAIContract'>
      <b>Havan contract for the AI</b>
      <p>Use <code>topic_identity</code>, never invent <code>topic_id</code>. If an identity is not present in the supplied catalog, return it as unresolved instead of guessing.</p>
    </section>
  </div>
}
