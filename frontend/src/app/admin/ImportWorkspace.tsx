'use client'

import {useEffect, useState} from 'react'
import {apiFetch} from '../../lib/api'

type R=Record<string,string|number|null|undefined>
type C={items:R[];total:number}
type Topic={name:string}
type Chapter={name:string;topics:Topic[]}
type Course={name:string;code:string;chapters:Chapter[]}
type Preview={university_id:number;curriculum_id:number;stream_id:number;courses:Course[];created_courses?:number;created_chapters?:number;created_topics?:number}

export default function ImportWorkspace({onImported}:{onImported:()=>Promise<void>}){
  const [parents,setParents]=useState<Record<string,R[]>>({})
  const [universityId,setUniversityId]=useState('')
  const [curriculumId,setCurriculumId]=useState('')
  const [streamId,setStreamId]=useState('')
  const [file,setFile]=useState<File|null>(null)
  const [preview,setPreview]=useState<Preview|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  useEffect(()=>{loadParents()},[])
  async function loadParents(){
    const map=[['university','universities'],['curriculum','curriculums'],['stream','streams']]
    const out:Record<string,R[]>={}
    await Promise.all(map.map(async ([key,endpoint])=>{
      try{out[key]=(await apiFetch<C>('/'+endpoint+'?page=1&page_size=100')).items}catch{out[key]=[]}
    }))
    setParents(out)
  }

  const curricula=(parents.curriculum??[]).filter(x=>!universityId||String(x.university_id)===universityId)
  const streams=(parents.stream??[]).filter(x=>!curriculumId||String(x.curriculum_id)===curriculumId)

  async function previewFile(){
    if(!universityId||!curriculumId||!streamId||!file){setError('Select the university, curriculum, stream, and a bullet-formatted file.');return}
    setBusy(true);setError('');setMessage('Parsing file…')
    try{
      const form=new FormData();form.append('file',file)
      const data=await apiFetch<Preview>(`/curriculum-import/preview?university_id=${universityId}&curriculum_id=${curriculumId}&stream_id=${streamId}`,{method:'POST',body:form})
      setPreview(data);setMessage('Preview ready. Nothing has been saved yet.')
    }catch(err){setPreview(null);setMessage('');setError(err instanceof Error?err.message:'Could not parse the file.')}
    finally{setBusy(false)}
  }

  async function commit(){
    if(!preview)return
    setBusy(true);setError('')
    try{
      const result=await apiFetch<Preview>('/curriculum-import/commit',{method:'POST',body:JSON.stringify(preview)})
      setMessage(`Imported ${result.created_courses} courses, ${result.created_chapters} chapters, and ${result.created_topics} topics.`)
      setPreview(null);setFile(null);await onImported()
    }catch(err){setError(err instanceof Error?err.message:'Could not save the curriculum import.')}
    finally{setBusy(false)}
  }

  return <div className="importPage">
    <header className="importHeader"><div><span>HAVAN STUDY PLANNER</span><h1>Import curriculum</h1></div></header>
    <section className="importHero"><div><span>PRIMARY CURRICULUM WORKFLOW</span><h2>Upload once. Review the structure. Save it.</h2><p>Admins provide a simple bullet-formatted file. Havan converts it into courses, chapters, and topics.</p></div><div className="importSteps"><b>01 Upload</b><b>02 Preview</b><b>03 Confirm</b></div></section>
    <section className="importGrid">
      <div className="importCard"><h3>1. Choose where it belongs</h3><p className="muted">Select the existing academic container. You do not manually enter every course and topic.</p>
        <label><span>University</span><select value={universityId} onChange={e=>{setUniversityId(e.target.value);setCurriculumId('');setStreamId('');setPreview(null)}}><option value="">Select university…</option>{(parents.university??[]).map(r=><option key={String(r.id)} value={String(r.id)}>{String(r.name)}</option>)}</select></label>
        <label><span>Curriculum</span><select value={curriculumId} onChange={e=>{setCurriculumId(e.target.value);setStreamId('');setPreview(null)}}><option value="">Select curriculum…</option>{curricula.map(r=><option key={String(r.id)} value={String(r.id)}>{String(r.name)} · v{String(r.version)}</option>)}</select></label>
        <label><span>Stream</span><select value={streamId} onChange={e=>{setStreamId(e.target.value);setPreview(null)}}><option value="">Select stream…</option>{streams.map(r=><option key={String(r.id)} value={String(r.id)}>{String(r.name)}</option>)}</select></label>
      </div>
      <div className="importCard"><h3>2. Upload the bullet file</h3>
        <div className="dropzone"><input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={e=>{setFile(e.target.files?.[0]??null);setPreview(null)}}/><strong>{file?file.name:'Choose .txt or .md file'}</strong><small>UTF-8 · maximum 2 MB</small></div>
        <pre>{`• [PHY101] Physics
  • Measurement
    • Physical quantities
    • Units and dimensions
  • Vectors
    • Scalars and vectors
    • Vector operations`}</pre>
        <button className="primary importButton" disabled={busy} onClick={previewFile}>{busy?'Working…':'Preview curriculum'}</button>
      </div>
    </section>
    {message&&<div className="notice importNotice">{message}</div>}
    {error&&<div className="alert importNotice">{error}<button onClick={()=>setError('')}>×</button></div>}
    {preview&&<section className="previewCard"><header><div><span>NOT SAVED YET</span><h2>Review imported structure</h2></div><strong>{preview.courses.length} courses</strong></header>
      <div className="tree">{preview.courses.map((course,ci)=><div className="treeCourse" key={ci}><b>{course.name}</b><small>{course.code}</small>{course.chapters.map((chapter,hi)=><div className="treeChapter" key={hi}><b>{chapter.name}</b><span>{chapter.topics.length} topics</span>{chapter.topics.map((topic,ti)=><div className="treeTopic" key={ti}>{topic.name}</div>)}</div>)}</div>)}</div>
      <footer><button onClick={()=>setPreview(null)}>Cancel</button><button className="primary" disabled={busy} onClick={commit}>{busy?'Saving…':'Confirm and save'}</button></footer>
    </section>}
  </div>
}
