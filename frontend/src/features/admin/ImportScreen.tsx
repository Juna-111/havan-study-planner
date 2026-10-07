'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type CoursePreview = { code:string; name:string; content_version:string; category_codes:string[]; action:string; chapters:{name:string;topics:{name:string;difficulty:number;important_points?:string|null}[]}[] }

type ImportKind = 'course' | 'university' | 'promotion'

export default function ImportScreen() {
  const [file,setFile]=useState<File|null>(null)
  const [kind,setKind]=useState<ImportKind>('course')
  const [version,setVersion]=useState('1.0')
  const [coursePreview,setCoursePreview]=useState<CoursePreview[]>([])
  const [summary,setSummary]=useState<{kind:ImportKind;data:Record<string,number>}|null>(null)
  const [busy,setBusy]=useState<'preview'|'save'|null>(null)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  function clear(){setCoursePreview([]);setSummary(null);setMessage('');setError('')}
  async function selectFile(next: File|null){
    setFile(next); clear()
    if(!next){setKind('course');return}
    if(next.name.toLowerCase().endsWith('.csv')){setKind('university');return}
    try{
      const first=(await next.text()).split(/\\r?\\n/).map((line)=>line.trim()).find(Boolean)?.toUpperCase()
      setKind(first==='TYPE: HAVAN_PROMOTION_V1'?'promotion':'course')
    }catch{setKind('course')}
  }

  async function preview(){
    if(!file){setError('Choose a .csv, .txt or .md file.');return}
    setBusy('preview');setError('');setMessage('')
    try{
      const fd=new FormData();fd.append('file',file)
      if(kind==='university'){
        const data=await apiFetch<Record<string,number>>('/admin-file-import/university/preview',{method:'POST',body:fd})
        setSummary({kind,data});setMessage('University import validated. Nothing has been changed.')
      }else if(kind==='promotion'){
        const data=await apiFetch<Record<string,number>>('/admin-file-import/promotion/preview',{method:'POST',body:fd})
        setSummary({kind,data});setMessage('Havan promotion import validated. Nothing has been changed.')
      }else{
        const data=await apiFetch<CoursePreview[]>('/freshman-registry-import/preview?content_version='+encodeURIComponent(version.trim()||'1.0'),{method:'POST',body:fd})
        setCoursePreview(data);setMessage(data.length+' course'+(data.length===1?'':'s')+' parsed. Nothing has been changed.')
      }
    }catch(e){clear();setError(e instanceof Error?e.message:'Could not validate the file.')}
    finally{setBusy(null)}
  }

  async function save(){
    if(!file)return
    setBusy('save');setError('')
    try{
      const fd=new FormData();fd.append('file',file)
      if(kind==='university'){
        const data=await apiFetch<Record<string,number>>('/admin-file-import/university/commit',{method:'POST',body:fd})
        setMessage('University import applied: '+data.universities+' universities, '+data.curriculums+' curricula, '+data.streams+' streams, '+data.courses+' courses, '+data.mappings+' mappings.')
      }else if(kind==='promotion'){
        const data=await apiFetch<Record<string,number>>('/admin-file-import/promotion/commit',{method:'POST',body:fd})
        setMessage('Havan promotion import applied: '+data.created+' created, '+data.updated+' updated.')
      }else{
        if(!coursePreview.length)return
        const fd=new FormData();fd.append('file',file);fd.append('content_version',version.trim()||'1.0')
        const data=await apiFetch<CoursePreview[]>('/freshman-registry-import/commit',{method:'POST',body:fd})
        setMessage(data.length+' course'+(data.length===1?'':'s')+' imported successfully.')
      }
      setCoursePreview([]);setSummary(null);setFile(null)
    }catch(e){setError(e instanceof Error?e.message:'Import failed. No records were saved.')}
    finally{setBusy(null)}
  }

  const courseTopics=coursePreview.reduce((n,c)=>n+c.chapters.reduce((m,ch)=>m+ch.topics.length,0),0)
  const ready=kind==='course'?coursePreview.length>0:!!summary

  return <section>
    <header className={styles.header}>
      <span>ACADEMIC SETUP · AUTOMATIC IMPORT</span>
      <h1>Upload administration data</h1>
      <p>Upload one source file and Havan handles university registration, curriculum, streams, course mapping, course content, or Havan promotions.</p>
    </header>
    {(message||error)&&<div className={error?styles.alert:styles.notice}>{error||message}</div>}
    <div className={styles.importCard}>
      <div className={styles.importStatus}><div><span>FILE TYPE</span><strong>{file?kind.toUpperCase():'WAITING FOR FILE'}</strong></div><small>{file?file.name:'CSV = university setup · TXT/MD = course; promotion files must declare TYPE: HAVAN_PROMOTION_V1'}</small></div>
      {file&&kind==='course'&&<label>Course content version<input value={version} onChange={e=>setVersion(e.target.value)} /></label>}
      <div className={styles.filePicker}>
        <div><span className={styles.fieldKicker}>SOURCE FILE</span><strong>{file?file.name:'No file selected'}</strong><small>.csv, .txt or .md · UTF-8 · maximum 5 MB</small></div>
        <label className={styles.fileButton}><span>{file?'Change file':'Choose file'}</span><input type="file" accept=".csv,.txt,.md,text/csv,text/plain,text/markdown" onChange={e=>{void selectFile(e.target.files?.[0]||null)}} /></label>
      </div>
      <div className={styles.actions}>
        <button disabled={busy!==null||!file} onClick={()=>void preview()}>{busy==='preview'?'Validating…':'Validate & preview'}</button>
        <button className={styles.primary} disabled={busy!==null||!ready} onClick={()=>void save()}>{busy==='save'?'Applying…':'Apply import'}</button>
      </div>
    </div>
    {summary&&<div className={styles.preview}><h2>Import review</h2><p>{summary.kind==='university'?summary.data.rows+' CSV rows → '+summary.data.universities+' universities · '+summary.data.curriculums+' curricula · '+summary.data.streams+' streams · '+summary.data.course_mappings+' course mappings.':'Promotion blocks: '+summary.data.promotions+'.'}</p><small>No database changes are made until Apply import.</small></div>}
    {coursePreview.length>0&&<div className={styles.preview}><h2>Course content review</h2><p>{coursePreview.length} courses · {courseTopics} topics.</p>{coursePreview.map(c=><article key={c.code+'-'+c.content_version}><b>{c.code} · {c.name}</b><small>Version {c.content_version} · {c.action}</small>{c.chapters.map(ch=><div className={styles.indent} key={ch.name}><strong>{ch.name}</strong>{ch.topics.map(t=><span key={t.name}>{t.name} · difficulty {t.difficulty}{t.important_points?' · critical points added':''}</span>)}</div>)}</article>)}</div>}
  </section>
}
