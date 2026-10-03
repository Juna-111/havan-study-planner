'use client'

import {useEffect, useMemo, useState} from 'react'
import {apiFetch} from '../../lib/api'
import './management.css'

type University={id:number;name:string;code:string;description:string|null;status:string}
type Curriculum={id:number;university_id:number;name:string;version:string;academic_year:string|null;description:string|null;status:string}
type Stream={id:number;curriculum_id:number;name:string;code:string;description:string|null;status:string}
type Course={id:number;stream_id:number|null;code:string;name:string;description:string|null;credit_hours:number|null;status:string}
type Chapter={id:number;course_id:number;name:string;description:string|null;order_index:number;status:string}
type Topic={id:number;chapter_id:number;name:string;description:string|null;difficulty:number;estimated_study_minutes:number;exam_importance:number;conceptual_importance:number;order_index:number;status:string}

type Section='universities'|'curricula'|'streams'|'courses'|'chapters'|'topics'
const labels:Record<Section,string>={universities:'Universities',curricula:'Curricula',streams:'Streams',courses:'Courses',chapters:'Chapters',topics:'Topics'}

export default function AdminManagementWorkspace(){
  const [section,setSection]=useState<Section>('universities')
  const [universities,setUniversities]=useState<University[]>([])
  const [curricula,setCurricula]=useState<Curriculum[]>([])
  const [streams,setStreams]=useState<Stream[]>([])
  const [courses,setCourses]=useState<Course[]>([])
  const [chapters,setChapters]=useState<Chapter[]>([])
  const [topics,setTopics]=useState<Topic[]>([])
  const [universityId,setUniversityId]=useState('')
  const [curriculumId,setCurriculumId]=useState('')
  const [streamId,setStreamId]=useState('')
  const [courseId,setCourseId]=useState('')
  const [chapterId,setChapterId]=useState('')
  const [search,setSearch]=useState('')
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [editing,setEditing]=useState<number|null>(null)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [form,setForm]=useState<Record<string,string>>({})

  async function load(){
    setLoading(true);setError('')
    try{
      const [u,c,s,co,ch,t]=await Promise.all([
        apiFetch<{items:University[]}>('/universities?page=1&page_size=100'),
        apiFetch<{items:Curriculum[]}>('/curriculums?page=1&page_size=100'),
        apiFetch<{items:Stream[]}>('/streams?page=1&page_size=100'),
        apiFetch<{items:Course[]}>('/courses?page=1&page_size=100'),
        apiFetch<{items:Chapter[]}>('/chapters?page=1&page_size=100'),
        apiFetch<{items:Topic[]}>('/topics?page=1&page_size=100'),
      ])
      setUniversities(u.items);setCurricula(c.items);setStreams(s.items);setCourses(co.items);setChapters(ch.items);setTopics(t.items)
    }catch(e){setError(e instanceof Error?e.message:'Could not load management data.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[])
  useEffect(()=>{setEditing(null);setForm({});setSearch('')},[section])

  const filtered=useMemo(()=>{
    const term=search.trim().toLowerCase()
    const rows:any[]=section==='universities'?universities:
      section==='curricula'?curricula.filter(x=>!universityId||String(x.university_id)===universityId):
      section==='streams'?streams.filter(x=>!curriculumId||String(x.curriculum_id)===curriculumId):
      section==='courses'?courses.filter(x=>!streamId||String(x.stream_id)===streamId):
      section==='chapters'?chapters.filter(x=>!courseId||String(x.course_id)===courseId):
      topics.filter(x=>!chapterId||String(x.chapter_id)===chapterId)
    return term?rows.filter(x=>JSON.stringify(x).toLowerCase().includes(term)):rows
  },[section,universities,curricula,streams,courses,chapters,topics,universityId,curriculumId,streamId,courseId,chapterId,search])

  function beginEdit(item:any){
    setEditing(item.id)
    const next:Record<string,string>={}
    Object.entries(item).forEach(([key,value])=>{if(!['id','created_at','updated_at','registry_key','academic_scope'].includes(key)&&value!==null)next[key]=String(value)})
    setForm(next)
  }
  function clearForm(){setEditing(null);setForm({})}
  function payload(){
    if(section==='universities')return {name:form.name||'',code:form.code||'',description:form.description||'',status:form.status||'ACTIVE'}
    if(section==='curricula')return {university_id:Number(universityId),name:form.name||'',version:form.version||'',academic_year:form.academic_year||'',description:form.description||'',status:form.status||'DRAFT'}
    if(section==='streams')return {curriculum_id:Number(curriculumId),name:form.name||'',code:form.code||'',description:form.description||'',status:form.status||'ACTIVE'}
    if(section==='courses')return {stream_id:Number(streamId),code:form.code||'',name:form.name||'',description:form.description||'',credit_hours:form.credit_hours?Number(form.credit_hours):null,status:form.status||'ACTIVE'}
    if(section==='chapters')return {course_id:Number(courseId),name:form.name||'',description:form.description||'',order_index:Number(form.order_index||1),status:form.status||'ACTIVE'}
    return {chapter_id:Number(chapterId),name:form.name||'',description:form.description||'',difficulty:Number(form.difficulty||3),estimated_study_minutes:Number(form.estimated_study_minutes||60),exam_importance:Number(form.exam_importance||0.5),conceptual_importance:Number(form.conceptual_importance||0.5),order_index:Number(form.order_index||1),status:form.status||'ACTIVE'}
  }
  const endpoint='/'+(section==='universities'?'universities':section==='curricula'?'curriculums':section)

  async function save(){
    setSaving(true);setError('');setMessage('')
    try{
      const result=await apiFetch<any>(editing?endpoint+'/'+editing:endpoint,{method:editing?'PATCH':'POST',body:JSON.stringify(payload())})
      setMessage(editing?labels[section].slice(0,-1)+' updated.':labels[section].slice(0,-1)+' created.')
      clearForm();await load()
      if(section==='universities')setUniversityId(String(result.id))
      if(section==='curricula')setCurriculumId(String(result.id))
      if(section==='streams')setStreamId(String(result.id))
      if(section==='courses')setCourseId(String(result.id))
      if(section==='chapters')setChapterId(String(result.id))
    }catch(e){setError(e instanceof Error?e.message:'Could not save this record.')}
    finally{setSaving(false)}
  }

  async function remove(item:any){
    if(!window.confirm('Delete this '+labels[section].slice(0,-1).toLowerCase()+'? This may fail when dependent records still exist.'))return
    setError('');setMessage('')
    try{
      await apiFetch(endpoint+'/'+item.id,{method:'DELETE'})
      setMessage(labels[section].slice(0,-1)+' deleted.')
      if(editing===item.id)clearForm()
      await load()
    }catch(e){setError(e instanceof Error?e.message:'Could not delete this record. Check dependent records.')}
  }

  const selector=section==='curricula'?<select value={universityId} onChange={e=>setUniversityId(e.target.value)}><option value=''>All universities</option>{universities.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select>:
    section==='streams'?<select value={curriculumId} onChange={e=>setCurriculumId(e.target.value)}><option value=''>All curricula</option>{curricula.map(x=><option key={x.id} value={x.id}>{x.name} · v{x.version}</option>)}</select>:
    section==='courses'?<select value={streamId} onChange={e=>setStreamId(e.target.value)}><option value=''>All streams</option>{streams.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select>:
    section==='chapters'?<select value={courseId} onChange={e=>setCourseId(e.target.value)}><option value=''>All courses</option>{courses.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select>:
    section==='topics'?<select value={chapterId} onChange={e=>setChapterId(e.target.value)}><option value=''>All chapters</option>{chapters.map(x=><option key={x.id} value={x.id}>{x.order_index}. {x.name}</option>)}</select>:null

  const field=(key:string,label:string,type='text',placeholder='')=><label key={key}><span>{label}</span><input type={type} value={form[key]||''} onChange={e=>setForm(x=>({...x,[key]:e.target.value}))} placeholder={placeholder}/></label>

  return <div className='managementPage'>
    <header className='workspaceHeader'><div><span>HAVAN ADMIN MANAGEMENT</span><h1>Manage academic data</h1><p>One normal control workspace for maintaining the hierarchy behind Havan. Edit records here; use import workspaces for bulk content.</p></div></header>
    {message&&<div className='notice workspaceNotice'>{message}</div>}
    {error&&<div className='alert workspaceNotice'>{error}<button onClick={()=>setError('')}>×</button></div>}
    <nav className='managementTabs' aria-label='Academic data sections'>{(Object.keys(labels) as Section[]).map(key=><button key={key} className={section===key?'active':''} onClick={()=>setSection(key)}>{labels[key]}</button>)}</nav>
    <section className='managementToolbar'>{selector}<input value={search} onChange={e=>setSearch(e.target.value)} placeholder={'Search '+labels[section].toLowerCase()+'…'}/><button onClick={clearForm}>New</button></section>
    <section className='managementGrid'>
      <div className='managementCard'>
        <div className='managementCardHead'><div><span>{editing?'EDIT RECORD':'NEW RECORD'}</span><h2>{editing?'Edit '+labels[section].slice(0,-1):'Add '+labels[section].slice(0,-1)}</h2></div></div>
        {section==='universities'&&<>{field('name','Name','text','Addis Ababa University')}{field('code','Code','text','AAU')}{field('description','Description')}{field('status','Status')}</>}
        {section==='curricula'&&<>{field('name','Name','text','Freshman Curriculum')}{field('version','Version','text','2025.1')}{field('academic_year','Academic year','text','2025/26')}{field('description','Description')}{field('status','Status')}</>}
        {section==='streams'&&<>{field('name','Name','text','Natural Science')}{field('code','Code','text','NATURAL')}{field('description','Description')}{field('status','Status')}</>}
        {section==='courses'&&<>{field('code','Code','text','PHY101')}{field('name','Name','text','Physics')}{field('credit_hours','Credit hours','number','3')}{field('description','Description')}{field('status','Status')}</>}
        {section==='chapters'&&<>{field('name','Name','text','Measurement')}{field('order_index','Order','number','1')}{field('description','Description')}{field('status','Status')}</>}
        {section==='topics'&&<>{field('name','Name','text','Physical quantities')}{field('order_index','Order','number','1')}{field('difficulty','Difficulty 1–5','number','3')}{field('estimated_study_minutes','Study minutes','number','60')}{field('exam_importance','Exam importance 0–1','number','0.5')}{field('conceptual_importance','Conceptual importance 0–1','number','0.5')}{field('description','Description')}{field('status','Status')}</>}
        <div className='managementActions'><button onClick={clearForm}>Clear</button><button className='workspacePrimary' disabled={saving} onClick={save}>{saving?'Saving…':editing?'Save changes':'Create'}</button></div>
        {section!=='universities'&&<small className='managementHint'>Choose the parent record in the filter above before creating a new child record.</small>}
      </div>
      <div className='managementCard managementListCard'>
        <div className='managementCardHead'><div><span>{labels[section].toUpperCase()}</span><h2>{filtered.length} record{filtered.length===1?'':'s'}</h2></div></div>
        {loading?<div className='empty'>Loading…</div>:filtered.length===0?<div className='empty'><h3>No records</h3><p>Create the first record or change the filter.</p></div>:
          <div className='managementList'>{filtered.map((item:any)=><article className='managementItem' key={item.id}><div><b>{item.code||('ID '+item.id)}</b><h3>{item.name}</h3><small>{section==='curricula'?'v'+item.version+' · '+item.status:section==='topics'?'Difficulty '+item.difficulty+'/5 · '+item.estimated_study_minutes+' min':item.status||''}</small></div><div className='managementItemActions'><button onClick={()=>beginEdit(item)}>Edit</button><button className='danger' onClick={()=>remove(item)}>Delete</button></div></article>)}</div>}
      </div>
    </section>
  </div>
}
