'use client'

import {useEffect, useState} from 'react'
import {apiFetch} from '../../lib/api'

type Category={id:number;code:string;name:string;description?:string|null}
type Course={id:number;code:string;name:string;description?:string|null;credit_hours?:number|null;academic_scope:string;registry_key:string;content_version:string;status:string;category_codes:string[]}
type Preview={code:string;name:string;content_version:string;category_codes:string[];chapters:{name:string;topics:{name:string;difficulty:number}[]}[]}

export default function FreshmanRegistryWorkspace(){
  const [courses,setCourses]=useState<Course[]>([])
  const [categories,setCategories]=useState<Category[]>([])
  const [form,setForm]=useState({code:'',name:'',content_version:'1.0',category_codes:[] as string[]})
  const [file,setFile]=useState<File|null>(null)
  const [preview,setPreview]=useState<Preview[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  async function load(){
    try{
      const [nextCourses,nextCategories]=await Promise.all([apiFetch<Course[]>('/freshman-registry/courses'),apiFetch<Category[]>('/freshman-registry/categories')])
      setCourses(nextCourses);setCategories(nextCategories)
    }catch(err){setError(err instanceof Error?err.message:'Could not load the Freshman registry.')}
  }
  useEffect(()=>{load()},[])
  function toggleCategory(code:string){setForm(x=>({...x,category_codes:x.category_codes.includes(code)?x.category_codes.filter(c=>c!==code):[...x.category_codes,code]}))}
  async function createCourse(){
    if(!form.code||!form.name){setError('Course code and name are required.');return}
    setBusy(true);setError('');setMessage('')
    try{await apiFetch<Course>('/freshman-registry/courses',{method:'POST',body:JSON.stringify(form)});setForm({code:'',name:'',content_version:'1.0',category_codes:[]});setMessage('Freshman course created in the national registry.');await load()}
    catch(err){setError(err instanceof Error?err.message:'Could not create the course.')}
    finally{setBusy(false)}
  }
  async function previewFile(){
    if(!file){setError('Choose a .txt or .md course file first.');return}
    setBusy(true);setError('');setMessage('')
    try{const fd=new FormData();fd.append('file',file);const data=await apiFetch<Preview[]>('/freshman-registry-import/preview?content_version='+encodeURIComponent(form.content_version||'1.0'),{method:'POST',body:fd});setPreview(data);setMessage('Preview ready. Nothing has been saved yet.')}
    catch(err){setError(err instanceof Error?err.message:'Could not parse the course file.')}
    finally{setBusy(false)}
  }
  async function commitPreview(){
    if(!preview.length)return
    setBusy(true);setError('')
    try{await apiFetch('/freshman-registry-import/commit',{method:'POST',body:JSON.stringify(preview.map(x=>({...x,category_codes:form.category_codes})))});setPreview([]);setFile(null);setMessage('Freshman course content imported into the reusable registry.');await load()}
    catch(err){setError(err instanceof Error?err.message:'Could not save the import.')}
    finally{setBusy(false)}
  }
  return <div className='workspacePage'>
    <header className='workspaceHeader'><div><span>HAVAN ACADEMIC REGISTRY</span><h1>Freshman course registry</h1><p className='muted'>Create reusable national course content once. Universities will reference it later instead of duplicating it.</p></div></header>
    {message&&<div className='notice importNotice'>{message}</div>}
    {error&&<div className='alert importNotice'>{error}<button onClick={()=>setError('')}>×</button></div>}
    <section className='workspaceGrid'>
      <div className='workspaceCard'><h3>1. Create a national course</h3><p className='muted'>No university or stream is selected here. That is intentional.</p>
        <label><span>Course code</span><input value={form.code} onChange={e=>setForm(x=>({...x,code:e.target.value}))} placeholder='Math 1011'/></label>
        <label><span>Course name</span><input value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))} placeholder='Applied Mathematics I'/></label>
        <label><span>Content version</span><input value={form.content_version} onChange={e=>setForm(x=>({...x,content_version:e.target.value}))} placeholder='1.0'/></label>
        <div className='workspaceField categoryPicker'><span>Freshman classification</span><div className='structureBadge'>{categories.map(c=><button type='button' key={c.code} className={form.category_codes.includes(c.code)?'selCat':''} onClick={()=>toggleCategory(c.code)}>{c.name}</button>)}</div></div>
        <button className='primary importButton' disabled={busy} onClick={createCourse}>{busy?'Saving…':'Create registry course'}</button>
      </div>
      <div className='workspaceCard'><h3>2. Import course hierarchy</h3><p className='muted'>Use the same Course → Chapter → Topic format already supported by Havan.</p>
        <div className='workspaceDropzone'><input type='file' accept='.txt,.md,text/plain,text/markdown' onChange={e=>{setFile(e.target.files?.[0]??null);setPreview([])}}/><strong>{file?file.name:'Choose .txt or .md file'}</strong><small>UTF-8 · maximum 5 MB</small></div>
        <pre>{`Course: [Math 1011] Applied Mathematics I
Chapter: Measurement
  • Physical quantities [3]
  • Units and dimensions [2]

Chapter: Vectors
  • Scalars and vectors [3]
  • Vector operations [4]`}</pre>
        <button className='primary importButton' disabled={busy||!file} onClick={previewFile}>{busy?'Working…':'Preview course'}</button>
      </div>
    </section>
    {preview.length>0&&<section className='workspacePanel'><header><div><span>NOT SAVED YET</span><h2>Review registry content</h2></div><strong>{preview.length} course{preview.length===1?'':'s'}</strong></header>
      <div className='workspaceTree'>{preview.map((course,i)=><div className='workspaceTreeCourse' key={i}><b>{course.code} · {course.name}</b>{course.chapters.map((chapter,j)=><div className='workspaceTreeChapter' key={j}><b>{chapter.name}</b><span>{chapter.topics.length} topics</span>{chapter.topics.map((topic,k)=><div className='workspaceTreeTopic' key={k}>{topic.name} <small>[difficulty {topic.difficulty}]</small></div>)}</div>)}</div>)}</div>
      <footer><button onClick={()=>setPreview([])}>Cancel</button><button className='primary' disabled={busy} onClick={commitPreview}>{busy?'Saving…':'Confirm and save'}</button></footer></section>}
    <section className='workspacePanel' ><header><div><span>REUSABLE CONTENT</span><h2>National freshman courses</h2></div><strong>{courses.length} courses</strong></header>
      {courses.length===0?<div className='empty'><b>+</b><h3>No national courses yet</h3><p>Create or import the first Freshman course.</p></div>:<div className='workspaceTree'>{courses.map(course=><div className='workspaceTreeCourse' key={course.id}><b>{course.code} · {course.name}</b><small>Registry: {course.registry_key} · Content v{course.content_version}</small><div className='structureBadge'>{course.category_codes.map(code=><b key={code}>{categories.find(c=>c.code===code)?.name??code}</b>)}</div></div>)}</div>}</section>
  </div>
}