'use client'

import {useEffect,useMemo,useState} from 'react'
import {apiFetch} from '../../lib/api'

type University={id:number;name:string;code:string;description:string|null;status:string}
type Curriculum={id:number;university_id:number;name:string;version:string;academic_year:string|null;description:string|null;status:string}
type Stream={id:number;curriculum_id:number;name:string;code:string;description:string|null;status:string}

const emptyUniversity={name:'',code:'',description:'',status:'ACTIVE'}
const emptyCurriculum={name:'',version:'',academic_year:'',description:'',status:'DRAFT'}
const emptyStream={name:'',code:'',description:'',status:'ACTIVE'}

export default function UniversitySetupWorkspace(){
  const [universities,setUniversities]=useState<University[]>([])
  const [curriculums,setCurriculums]=useState<Curriculum[]>([])
  const [streams,setStreams]=useState<Stream[]>([])
  const [universityId,setUniversityId]=useState('')
  const [curriculumId,setCurriculumId]=useState('')
  const [universityForm,setUniversityForm]=useState({...emptyUniversity})
  const [curriculumForm,setCurriculumForm]=useState({...emptyCurriculum})
  const [streamForm,setStreamForm]=useState({...emptyStream})
  const [editingUniversity,setEditingUniversity]=useState<number|null>(null)
  const [editingCurriculum,setEditingCurriculum]=useState<number|null>(null)
  const [editingStream,setEditingStream]=useState<number|null>(null)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState('')
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  async function load(){
    setLoading(true)
    setError('')
    try{
      const [u,c,s]=await Promise.all([
        apiFetch<{items:University[]}>('/universities?page=1&page_size=100'),
        apiFetch<{items:Curriculum[]}>('/curriculums?page=1&page_size=100'),
        apiFetch<{items:Stream[]}>('/streams?page=1&page_size=100')
      ])
      setUniversities(u.items)
      setCurriculums(c.items)
      setStreams(s.items)
      if(!universityId&&u.items[0])setUniversityId(String(u.items[0].id))
    }catch(err){
      setError(err instanceof Error?err.message:'Could not load university setup.')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{load()},[])

  const selectedUniversity=universities.find(item=>String(item.id)===universityId)
  const universityCurriculums=useMemo(
    ()=>curriculums.filter(item=>String(item.university_id)===universityId),
    [curriculums,universityId]
  )
  const selectedCurriculum=curriculums.find(item=>String(item.id)===curriculumId)
  const curriculumStreams=useMemo(
    ()=>streams.filter(item=>String(item.curriculum_id)===curriculumId),
    [streams,curriculumId]
  )

  useEffect(()=>{
    if(universityCurriculums.length && !universityCurriculums.some(item=>String(item.id)===curriculumId)){
      setCurriculumId(String(universityCurriculums[0].id))
    }
    if(!universityCurriculums.length)setCurriculumId('')
  },[universityCurriculums,curriculumId])

  function resetUniversity(){setUniversityForm({...emptyUniversity});setEditingUniversity(null)}
  function resetCurriculum(){setCurriculumForm({...emptyCurriculum});setEditingCurriculum(null)}
  function resetStream(){setStreamForm({...emptyStream});setEditingStream(null)}

  function editUniversity(item:University){
    setUniversityId(String(item.id))
    setUniversityForm({
      name:item.name,code:item.code,description:item.description||'',status:item.status
    })
    setEditingUniversity(item.id)
  }

  function editCurriculum(item:Curriculum){
    setCurriculumId(String(item.id))
    setCurriculumForm({
      name:item.name,version:item.version,academic_year:item.academic_year||'',
      description:item.description||'',status:item.status
    })
    setEditingCurriculum(item.id)
  }

  function editStream(item:Stream){
    setStreamForm({
      name:item.name,code:item.code,description:item.description||'',status:item.status
    })
    setEditingStream(item.id)
  }

  async function saveUniversity(){
    setSaving('university');setError('');setMessage('')
    try{
      const options={method:editingUniversity?'PATCH':'POST',body:JSON.stringify(universityForm)}
      const result=await apiFetch<University>(
        editingUniversity?'/universities/'+editingUniversity:'/universities',
        options
      )
      setMessage(editingUniversity?'University updated.':'University created.')
      setUniversityId(String(result.id))
      resetUniversity()
      await load()
    }catch(err){setError(err instanceof Error?err.message:'Could not save university.')}
    finally{setSaving('')}
  }

  async function saveCurriculum(){
    if(!universityId){setError('Select a university first.');return}
    setSaving('curriculum');setError('');setMessage('')
    try{
      const body={...curriculumForm,university_id:Number(universityId)}
      const result=await apiFetch<Curriculum>(
        editingCurriculum?'/curriculums/'+editingCurriculum:'/curriculums',
        {method:editingCurriculum?'PATCH':'POST',body:JSON.stringify(editingCurriculum?curriculumForm:body)}
      )
      setMessage(editingCurriculum?'Curriculum updated.':'Curriculum created.')
      setCurriculumId(String(result.id))
      resetCurriculum()
      await load()
    }catch(err){setError(err instanceof Error?err.message:'Could not save curriculum.')}
    finally{setSaving('')}
  }

  async function saveStream(){
    if(!curriculumId){setError('Select a curriculum first.');return}
    setSaving('stream');setError('');setMessage('')
    try{
      const body={...streamForm,curriculum_id:Number(curriculumId)}
      const result=await apiFetch<Stream>(
        editingStream?'/streams/'+editingStream:'/streams',
        {method:editingStream?'PATCH':'POST',body:JSON.stringify(editingStream?streamForm:body)}
      )
      setMessage(editingStream?'Stream updated.':'Stream created.')
      resetStream()
      await load()
      setCurriculumId(String(result.curriculum_id))
    }catch(err){setError(err instanceof Error?err.message:'Could not save stream.')}
    finally{setSaving('')}
  }

  return <div className='workspacePage'>
    <header className='workspaceHeader'>
      <div>
        <span>HAVAN UNIVERSITY SETUP</span>
        <h1>University setup</h1>
        <p>Create the small amount of university context Havan needs before mapping the national Freshman curriculum.</p>
      </div>
    </header>

    {message&&<div className='notice workspaceNotice'>{message}</div>}
    {error&&<div className='alert workspaceNotice'>{error}<button onClick={()=>setError('')}>×</button></div>}

    <section className='workspaceGrid'>
      <div className='workspaceCard'>
        <h3>1. University</h3>
        <label><span>Existing universities</span><select value={universityId} onChange={e=>{setUniversityId(e.target.value);resetCurriculum();resetStream()}}><option value=''>Select university…</option>{universities.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label><span>Name</span><input value={universityForm.name} onChange={e=>setUniversityForm({...universityForm,name:e.target.value})} placeholder='University name'/></label>
        <label><span>Code</span><input value={universityForm.code} onChange={e=>setUniversityForm({...universityForm,code:e.target.value})} placeholder='e.g. UAA'/></label>
        <label><span>Description</span><textarea rows={2} value={universityForm.description} onChange={e=>setUniversityForm({...universityForm,description:e.target.value})}/></label>
        <label><span>Status</span><select value={universityForm.status} onChange={e=>setUniversityForm({...universityForm,status:e.target.value})}><option value='ACTIVE'>Active</option><option value='INACTIVE'>Inactive</option></select></label>
        <div className='workspaceActions'><button onClick={resetUniversity}>Clear</button><button className='workspacePrimary' disabled={saving==='university'||!universityForm.name||!universityForm.code} onClick={saveUniversity}>{saving==='university'?'Saving…':editingUniversity?'Save changes':'Add university'}</button></div>
        <div className='workspaceList'>{universities.map(item=><article className='overrideCard' key={item.id}><div className='overrideBody'><b>{item.code}</b><h3>{item.name}</h3><small>{item.status}</small></div><div className='overrideMeta'><button onClick={()=>editUniversity(item)}>Edit</button></div></article>)}</div>
      </div>

      <div className='workspaceCard'>
        <h3>2. Curriculum version</h3>
        <label><span>University</span><select value={universityId} onChange={e=>setUniversityId(e.target.value)}><option value=''>Select university…</option>{universities.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label><span>Name</span><input value={curriculumForm.name} onChange={e=>setCurriculumForm({...curriculumForm,name:e.target.value})} placeholder='Freshman curriculum'/></label>
        <label><span>Version</span><input value={curriculumForm.version} onChange={e=>setCurriculumForm({...curriculumForm,version:e.target.value})} placeholder='e.g. 2025.1'/></label>
        <label><span>Academic year</span><input value={curriculumForm.academic_year} onChange={e=>setCurriculumForm({...curriculumForm,academic_year:e.target.value})} placeholder='e.g. 2025/26'/></label>
        <label><span>Description</span><textarea rows={2} value={curriculumForm.description} onChange={e=>setCurriculumForm({...curriculumForm,description:e.target.value})}/></label>
        <label><span>Status</span><select value={curriculumForm.status} onChange={e=>setCurriculumForm({...curriculumForm,status:e.target.value})}><option value='DRAFT'>Draft</option><option value='ACTIVE'>Active</option><option value='ARCHIVED'>Archived</option></select></label>
        <div className='workspaceActions'><button onClick={resetCurriculum}>Clear</button><button className='workspacePrimary' disabled={saving==='curriculum'||!universityId||!curriculumForm.name||!curriculumForm.version} onClick={saveCurriculum}>{saving==='curriculum'?'Saving…':editingCurriculum?'Save changes':'Add curriculum'}</button></div>
        <div className='workspaceList'>{universityCurriculums.map(item=><article className='overrideCard' key={item.id}><div className='overrideBody'><b>{item.version}</b><h3>{item.name}</h3><small>{item.status}{item.academic_year?' · '+item.academic_year:''}</small></div><div className='overrideMeta'><button onClick={()=>editCurriculum(item)}>Edit</button></div></article>)}</div>
      </div>

      <div className='workspaceCard'>
        <h3>3. Streams</h3>
        <label><span>Curriculum</span><select value={curriculumId} onChange={e=>setCurriculumId(e.target.value)}><option value=''>Select curriculum…</option>{curriculums.filter(item=>String(item.university_id)===universityId).map(item=><option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></label>
        <label><span>Name</span><input value={streamForm.name} onChange={e=>setStreamForm({...streamForm,name:e.target.value})} placeholder='Natural Science'/></label>
        <label><span>Code</span><input value={streamForm.code} onChange={e=>setStreamForm({...streamForm,code:e.target.value})} placeholder='NATURAL'/></label>
        <label><span>Description</span><textarea rows={2} value={streamForm.description} onChange={e=>setStreamForm({...streamForm,description:e.target.value})}/></label>
        <label><span>Status</span><select value={streamForm.status} onChange={e=>setStreamForm({...streamForm,status:e.target.value})}><option value='ACTIVE'>Active</option><option value='INACTIVE'>Inactive</option></select></label>
        <div className='workspaceActions'><button onClick={resetStream}>Clear</button><button className='workspacePrimary' disabled={saving==='stream'||!curriculumId||!streamForm.name||!streamForm.code} onClick={saveStream}>{saving==='stream'?'Saving…':editingStream?'Save changes':'Add stream'}</button></div>
        {selectedCurriculum&&<div className='workspaceBaseline'><b>{selectedCurriculum.name} · v{selectedCurriculum.version}</b><span>{selectedUniversity?.name}</span><small>Streams belong to one university curriculum version.</small></div>}
        <div className='workspaceList'>{curriculumStreams.map(item=><article className='overrideCard' key={item.id}><div className='overrideBody'><b>{item.code}</b><h3>{item.name}</h3><small>{item.status}</small></div><div className='overrideMeta'><button onClick={()=>editStream(item)}>Edit</button></div></article>)}</div>
      </div>
    </section>

    {loading&&<div className='empty'>Loading university setup…</div>}
  </div>
}
