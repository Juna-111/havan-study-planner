'use client'

import {useEffect, useState} from 'react'
import {apiFetch} from '../../lib/api'

type R=Record<string,string|number|null|undefined>
type C={items:R[];total:number}
type Topic={name:string;difficulty:number}
type Chapter={name:string;topics:Topic[]}
type Course={name:string;code:string;chapters:Chapter[]}
type FullPreview={university_name:string;university_code:string;curriculum_name:string;curriculum_version:string;academic_year?:string|null;stream_name:string;stream_code:string;courses:Course[];university_id?:number;curriculum_id?:number;stream_id?:number;created_courses?:number;created_chapters?:number;created_topics?:number}
type ExistingPreview={university_id:number;curriculum_id:number;stream_id:number;courses:Course[];created_courses?:number;created_chapters?:number;created_topics?:number}

const MAX_FILE_SIZE=5*1024*1024

export default function ImportWorkspace({onImported}:{onImported:()=>Promise<void>}){
  const [mode,setMode]=useState<'full'|'content'>('full')
  const [parents,setParents]=useState<Record<string,R[]>>({})
  const [universityId,setUniversityId]=useState('')
  const [curriculumId,setCurriculumId]=useState('')
  const [streamId,setStreamId]=useState('')
  const [file,setFile]=useState<File|null>(null)
  const [preview,setPreview]=useState<FullPreview|ExistingPreview|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [loadingParents,setLoadingParents]=useState(true)

  useEffect(()=>{loadParents()},[])

  async function loadParents(){
    setLoadingParents(true);setError('')
    try{
      const [universities,curriculums,streams]=await Promise.all([
        apiFetch<C>('/universities?page=1&page_size=100'),
        apiFetch<C>('/curriculums?page=1&page_size=100'),
        apiFetch<C>('/streams?page=1&page_size=100')
      ])
      setParents({university:universities.items,curriculum:curriculums.items,stream:streams.items})
    }catch(err){
      setParents({university:[],curriculum:[],stream:[]})
      setError(err instanceof Error?err.message:'Could not load academic structure.')
    }finally{setLoadingParents(false)}
  }

  const curricula=(parents.curriculum??[]).filter(x=>!universityId||String(x.university_id)===universityId)
  const streams=(parents.stream??[]).filter(x=>!curriculumId||String(x.curriculum_id)===curriculumId)

  function chooseFile(next:File|null){
    setError('');setPreview(null)
    if(next&&next.size>MAX_FILE_SIZE){
      setFile(null);setError('The file is larger than 5 MB. Please upload a file up to 5 MB.');return
    }
    setFile(next)
  }

  async function previewFile(){
    if(!file){setError('Choose a .txt or .md file first.');return}
    if(mode==='content'&&(!universityId||!curriculumId||!streamId)){setError('Select the university, curriculum, and stream first.');return}
    setBusy(true);setError('');setMessage('Parsing file…')
    try{
      const url=mode==='full'?'/academic-structure-import/preview':\`/curriculum-import/preview?university_id=\${universityId}&curriculum_id=\${curriculumId}&stream_id=\${streamId}\`
      const form=new FormData();form.append('file',file)
      const data=await apiFetch<FullPreview|ExistingPreview>(url,{method:'POST',body:form})
      setPreview(data);setMessage('Preview ready. Nothing has been saved yet.')
    }catch(err){setPreview(null);setMessage('');setError(err instanceof Error?err.message:'Could not parse the file.')}
    finally{setBusy(false)}
  }

  async function commit(){
    if(!preview)return
    setBusy(true);setError('')
    try{
      const url=mode==='full'?'/academic-structure-import/commit':'/curriculum-import/commit'
      const result=await apiFetch<FullPreview|ExistingPreview>(url,{method:'POST',body:JSON.stringify(preview)})
      setMessage(\`Imported \${result.created_courses} courses, \${result.created_chapters} chapters, and \${result.created_topics} topics.\`)
      setPreview(null);setFile(null);await onImported();await loadParents()
    }catch(err){setError(err instanceof Error?err.message:'Could not save the import.')}
    finally{setBusy(false)}
  }

  const full=mode==='full'
  const previewCourses=preview?.courses??[]

  return <div className="importPage">
    <header className="importHeader"><div><span>HAVAN STUDY PLANNER</span><h1>Import academic data</h1><p className="muted">Load the real curriculum later without changing the planner.</p></div></header>

    <div className="manageTabs importModeTabs">
      <button className={full?'sel':''} onClick={()=>{setMode('full');setPreview(null);setFile(null);setError('')}}>Full academic structure</button>
      <button className={!full?'sel':''} onClick={()=>{setMode('content');setPreview(null);setFile(null);setError('')}}>Add course content</button>
    </div>

    <section className="importHero">
      <div><span>{full?'COMPLETE HIERARCHY IMPORT':'COURSE CONTENT IMPORT'}</span><h2>{full?'University → Curriculum → Stream → Course → Chapter → Topic':'Add Courses → Chapters → Topics to an existing stream'}</h2><p>{full?'Upload one structured file and Havan creates the complete academic hierarchy.':'Choose the existing academic container, then upload only its course/chapter/topic content.'}</p></div>
      <div className="importSteps"><b>01 Upload</b><b>02 Preview</b><b>03 Confirm</b></div>
    </section>

    <section className="importGrid">
      {full?<div className="importCard"><h3>1. Full structure</h3><p className="muted">This creates the University, Curriculum version, Stream, Courses, Chapters, and Topics together.</p><div className="structureBadge"><span>Creates</span><b>University</b><b>Curriculum</b><b>Stream</b><b>Course</b><b>Chapter</b><b>Topic</b></div></div>:<div className="importCard">
        <h3>1. Choose where it belongs</h3><p className="muted">Select the existing academic container.</p>
        <label><span>University</span><select disabled={loadingParents} value={universityId} onChange={e=>{setUniversityId(e.target.value);setCurriculumId('');setStreamId('');setPreview(null)}}><option value="">{loadingParents?'Loading universities…':'Select university…'}</option>{(parents.university??[]).map(r=><option key={String(r.id)} value={String(r.id)}>{String(r.name)}</option>)}</select></label>
        <label><span>Curriculum</span><select disabled={loadingParents||!universityId} value={curriculumId} onChange={e=>{setCurriculumId(e.target.value);setStreamId('');setPreview(null)}}><option value="">{loadingParents?'Loading curriculums…':'Select curriculum…'}</option>{curricula.map(r=><option key={String(r.id)} value={String(r.id)}>{String(r.name)} · v{String(r.version)}</option>)}</select></label>
        <label><span>Stream</span><select disabled={loadingParents||!curriculumId} value={streamId} onChange={e=>{setStreamId(e.target.value);setPreview(null)}}><option value="">{loadingParents?'Loading streams…':'Select stream…'}</option>{streams.map(r=><option key={String(r.id)} value={String(r.id)}>{String(r.name)}</option>)}</select></label>
      </div>}

      <div className="importCard"><h3>{full?'2. Upload the hierarchy file':'2. Upload the content file'}</h3>
        <div className="dropzone"><input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={e=>chooseFile(e.target.files?.[0]??null)}/><strong>{file?file.name:'Choose .txt or .md file'}</strong><small>UTF-8 · maximum 5 MB</small></div>
        <pre>{full?String.raw\`University: Havan Demo University
University Code: HAVAN-DEMO
Curriculum: Bachelor of Science
Version: 2026.1
Academic Year: 2026/27
Stream: Natural Science
Stream Code: NAT-SCI

Course: [PHY101] Physics
Chapter: Measurement
  • Physical quantities [3]
  • Units and dimensions [2]
Chapter: Vectors
  • Scalars and vectors [3]
  • Vector operations [4]

Course: [MATH101] Mathematics
Chapter: Algebra
  • Functions [3]
  • Equations [2]\`:String.raw\`Course: [PHY101] Physics
Chapter: Measurement
  • Physical quantities [3]
  • Units and dimensions [2]
Chapter: Vectors
  • Scalars and vectors [3]
  • Vector operations [4]\`}</pre>
        <button className="primary importButton" disabled={busy||!file} onClick={previewFile}>{busy?'Working…':'Preview structure'}</button>
      </div>
    </section>

    {message&&<div className="notice importNotice">{message}</div>}
    {error&&<div className="alert importNotice">{error}<button onClick={()=>setError('')}>×</button></div>}

    {preview&&<section className="previewCard"><header><div><span>NOT SAVED YET</span><h2>Review imported structure</h2></div><strong>{previewCourses.length} courses</strong></header>
      {full&&<div className="importHierarchy"><div><span>University</span><b>{(preview as FullPreview).university_name}</b></div><div><span>Curriculum</span><b>{(preview as FullPreview).curriculum_name} · v{(preview as FullPreview).curriculum_version}</b></div><div><span>Stream</span><b>{(preview as FullPreview).stream_name}</b></div></div>}
      <div className="tree">{previewCourses.map((course,ci)=><div className="treeCourse" key={ci}><b>{course.code} · {course.name}</b>{course.chapters.map((chapter,hi)=><div className="treeChapter" key={hi}><b>{chapter.name}</b><span>{chapter.topics.length} topics</span>{chapter.topics.map((topic,ti)=><div className="treeTopic" key={ti}>{topic.name} <small>[difficulty {topic.difficulty}]</small></div>)}</div>)}</div>)}</div>
      <footer><button onClick={()=>setPreview(null)}>Cancel</button><button className="primary" disabled={busy} onClick={commit}>{busy?'Saving…':'Confirm and save'}</button></footer>
    </section>}
  </div>
}
