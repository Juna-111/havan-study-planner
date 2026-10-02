'use client'

import {useEffect,useMemo,useState} from 'react'
import {apiFetch} from '../../lib/api'

type University={id:number;name:string;code:string}
type Curriculum={id:number;university_id:number;name:string;version:string;status:string}
type Stream={id:number;curriculum_id:number;name:string;code:string;status:string}
type Course={id:number;stream_id:number|null;code:string;name:string;credit_hours:number|null;status:string}
type NationalCourse={id:number;code:string;name:string;credit_hours:number|null;status:string}
type Override={
  id:number;curriculum_id:number;curriculum_name:string;university_id:number;university_name:string
  national_course_id:number|null;national_course_code:string|null;national_course_name:string|null
  local_course_id:number|null;local_course_code:string|null;local_course_name:string|null
  source_stream_id:number|null;source_stream_name:string|null;target_stream_id:number|null;target_stream_name:string|null
  override_type:string;semester_number:number|null;order_index:number|null
  local_code:string|null;local_title:string|null;local_credit_hours:number|null
  reason:string;source:string|null;status:string
}

const empty={override_type:'REMOVE',national_course_id:'',local_course_id:'',source_stream_id:'',target_stream_id:'',semester_number:'',order_index:'',local_code:'',local_title:'',local_credit_hours:'',reason:'',source:'',status:'DRAFT'}

export default function UniversityOverrideWorkspace(){
  const [universities,setUniversities]=useState<University[]>([])
  const [curriculums,setCurriculums]=useState<Curriculum[]>([])
  const [streams,setStreams]=useState<Stream[]>([])
  const [nationalCourses,setNationalCourses]=useState<NationalCourse[]>([])
  const [localCourses,setLocalCourses]=useState<Course[]>([])
  const [overrides,setOverrides]=useState<Override[]>([])
  const [universityId,setUniversityId]=useState('')
  const [curriculumId,setCurriculumId]=useState('')
  const [streamId,setStreamId]=useState('')
  const [form,setForm]=useState({...empty})
  const [editingId,setEditingId]=useState<number|null>(null)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  async function load(){
    setLoading(true);setError('')
    try{
      const [u,c,s,n,o]=await Promise.all([
        apiFetch<{items:University[]}>('/universities?page=1&page_size=100'),
        apiFetch<{items:Curriculum[]}>('/curriculums?page=1&page_size=100'),
        apiFetch<{items:Stream[]}>('/streams?page=1&page_size=100'),
        apiFetch<NationalCourse[]>('/freshman-registry/courses?status=ACTIVE'),
        apiFetch<Override[]>('/university-course-overrides')
      ])
      setUniversities(u.items);setCurriculums(c.items);setStreams(s.items);setNationalCourses(n);setOverrides(o)
      if(!universityId&&u.items[0])setUniversityId(String(u.items[0].id))
    }catch(err){setError(err instanceof Error?err.message:'Could not load university overrides.')}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[])

  const universityCurriculums=useMemo(
    ()=>curriculums.filter(item=>String(item.university_id)===universityId),
    [curriculums,universityId]
  )
  const selectedCurriculum=curriculums.find(item=>String(item.id)===curriculumId)
  const curriculumStreams=useMemo(
    ()=>streams.filter(item=>String(item.curriculum_id)===curriculumId),
    [streams,curriculumId]
  )
  const selectedStream=streams.find(item=>String(item.id)===streamId)
  const scopedOverrides=useMemo(
    ()=>overrides.filter(item=>String(item.curriculum_id)===curriculumId),
    [overrides,curriculumId]
  )

  useEffect(()=>{
    if(universityCurriculums.length && !universityCurriculums.some(item=>String(item.id)===curriculumId)){
      setCurriculumId(String(universityCurriculums[0].id))
    }
  },[universityCurriculums,curriculumId])

  useEffect(()=>{
    if(curriculumStreams.length && !curriculumStreams.some(item=>String(item.id)===streamId)){
      setStreamId(String(curriculumStreams[0].id))
    }
  },[curriculumStreams,streamId])

  useEffect(()=>{
    if(!streamId){setLocalCourses([]);return}
    apiFetch<{items:Course[]}>('/courses?stream_id='+streamId+'&page=1&page_size=100')
      .then(data=>setLocalCourses(data.items.filter(item=>item.status==='ACTIVE')))
      .catch(()=>setLocalCourses([]))
  },[streamId])

  function resetForm(){setForm({...empty});setEditingId(null)}

  function startEdit(item:Override){
    setForm({
      override_type:item.override_type,
      national_course_id:item.national_course_id?String(item.national_course_id):'',
      local_course_id:item.local_course_id?String(item.local_course_id):'',
      source_stream_id:item.source_stream_id?String(item.source_stream_id):'',
      target_stream_id:item.target_stream_id?String(item.target_stream_id):'',
      semester_number:item.semester_number?String(item.semester_number):'',
      order_index:item.order_index?String(item.order_index):'',
      local_code:item.local_code||'',
      local_title:item.local_title||'',
      local_credit_hours:item.local_credit_hours!=null?String(item.local_credit_hours):'',
      reason:item.reason,
      source:item.source||'',
      status:item.status
    })
    setEditingId(item.id)
  }

  async function save(){
    if(!curriculumId){setError('Select a curriculum first.');return}
    setSaving(true);setError('');setMessage('')
    try{
      const body:Record<string,unknown>={
        curriculum_id:Number(curriculumId),
        override_type:form.override_type,
        status:form.status,
        reason:form.reason,
        source:form.source||null,
        national_course_id:form.national_course_id?Number(form.national_course_id):null,
        local_course_id:form.local_course_id?Number(form.local_course_id):null,
        source_stream_id:form.source_stream_id?Number(form.source_stream_id):null,
        target_stream_id:form.target_stream_id?Number(form.target_stream_id):null,
        semester_number:form.semester_number?Number(form.semester_number):null,
        order_index:form.order_index?Number(form.order_index):null,
        local_code:form.local_code||null,
        local_title:form.local_title||null,
        local_credit_hours:form.local_credit_hours?Number(form.local_credit_hours):null
      }
      if(editingId){
        delete body.curriculum_id
        delete body.national_course_id
        delete body.local_course_id
        delete body.override_type
        await apiFetch('/university-course-overrides/'+editingId,{method:'PATCH',body:JSON.stringify(body)})
        setMessage('University override updated.')
      }else{
        await apiFetch('/university-course-overrides',{method:'POST',body:JSON.stringify(body)})
        setMessage('University override created.')
      }
      resetForm()
      const fresh=await apiFetch<Override[]>('/university-course-overrides')
      setOverrides(fresh)
    }catch(err){setError(err instanceof Error?err.message:'Could not save this override.')}
    finally{setSaving(false)}
  }

  async function remove(id:number){
    if(!confirm('Delete this university override?'))return
    try{
      await apiFetch('/university-course-overrides/'+id,{method:'DELETE'})
      setOverrides(items=>items.filter(item=>item.id!==id))
      setMessage('University override deleted.')
    }catch(err){setError(err instanceof Error?err.message:'Could not delete this override.')}
  }

  const type=form.override_type
  const needsNational=type!=='ADD'
  const needsTarget=type==='ADD'||type==='CHANGE_STREAM'
  const needsSemester=type==='MOVE'
  const needsMetadata=type==='METADATA'

  return <div className='workspacePage'>
    <header className='workspaceHeader'>
      <div>
        <span>HAVAN UNIVERSITY OVERRIDES</span>
        <h1>University overrides & exceptions</h1>
        <p>The national Freshman template is the baseline, not a prison. Change local placement without changing the national course hierarchy.</p>
      </div>
    </header>

    {message&&<div className='notice workspaceNotice'>{message}</div>}
    {error&&<div className='alert workspaceNotice'>{error}<button onClick={()=>setError('')}>×</button></div>}

    <section className='workspaceGrid'>
      <div className='workspaceCard'>
        <h3>1. Choose the university curriculum</h3>
        <label><span>University</span><select value={universityId} onChange={e=>setUniversityId(e.target.value)}><option value=''>Select university…</option>{universities.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label><span>Curriculum version</span><select value={curriculumId} onChange={e=>setCurriculumId(e.target.value)}><option value=''>Select curriculum…</option>{universityCurriculums.map(item=><option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></label>
        <label><span>Stream context</span><select value={streamId} onChange={e=>setStreamId(e.target.value)}><option value=''>All streams</option>{curriculumStreams.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        {selectedCurriculum&&<div className='workspaceBaseline'><b>{selectedCurriculum.name} · v{selectedCurriculum.version}</b><span>{selectedStream?selectedStream.name:'All streams'}</span><small>University-specific changes remain isolated to this curriculum.</small></div>}
      </div>

      <div className='workspaceCard'>
        <h3>2. Define the exception</h3>
        <label><span>Override type</span><select value={form.override_type} onChange={e=>setForm({...form,override_type:e.target.value})}>
          <option value='REMOVE'>Remove inherited course</option>
          <option value='MOVE'>Move between semesters</option>
          <option value='CHANGE_STREAM'>Change stream assignment</option>
          <option value='METADATA'>Override code / title / credits</option>
          <option value='ADD'>Add university-specific course</option>
        </select></label>

        {needsNational&&<label><span>National course</span><select value={form.national_course_id} onChange={e=>setForm({...form,national_course_id:e.target.value})}><option value=''>Select national course…</option>{nationalCourses.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>}
        {type==='ADD'&&<label><span>Local course</span><select value={form.local_course_id} onChange={e=>setForm({...form,local_course_id:e.target.value})}><option value=''>Select local course…</option>{localCourses.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>}
        {type!=='ADD'&&<label><span>Source stream</span><select value={form.source_stream_id} onChange={e=>setForm({...form,source_stream_id:e.target.value})}><option value=''>All / inherited scope</option>{curriculumStreams.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>}
        {needsTarget&&<label><span>Target stream</span><select value={form.target_stream_id} onChange={e=>setForm({...form,target_stream_id:e.target.value})}><option value=''>Select target stream…</option>{curriculumStreams.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>}
        {needsSemester&&<label><span>Destination semester</span><select value={form.semester_number} onChange={e=>setForm({...form,semester_number:e.target.value})}><option value=''>Select semester…</option><option value='1'>Semester I</option><option value='2'>Semester II</option></select></label>}
        {needsMetadata&&<div className='overrideFields'>
          <label><span>Local code</span><input value={form.local_code} onChange={e=>setForm({...form,local_code:e.target.value})} placeholder='e.g. PSY201'/></label>
          <label><span>Local title</span><input value={form.local_title} onChange={e=>setForm({...form,local_title:e.target.value})} placeholder='University title'/></label>
          <label><span>Local credits</span><input type='number' min='0' max='30' value={form.local_credit_hours} onChange={e=>setForm({...form,local_credit_hours:e.target.value})}/></label>
        </div>}
        <label><span>Order (optional)</span><input type='number' min='1' value={form.order_index} onChange={e=>setForm({...form,order_index:e.target.value})}/></label>
        <label><span>Reason</span><textarea rows={3} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder='Why does this university need this exception?'/></label>
        <label><span>Source / reference</span><input value={form.source} onChange={e=>setForm({...form,source:e.target.value})} placeholder='Policy, curriculum document, senate decision…'/></label>
        <label><span>Status</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value='DRAFT'>Draft</option><option value='ACTIVE'>Active</option><option value='ARCHIVED'>Archived</option></select></label>
        <div className='workspaceActions'><button onClick={resetForm}>Clear</button><button className='workspacePrimary' disabled={saving} onClick={save}>{saving?'Saving…':editingId?'Save changes':'Add override'}</button></div>
      </div>
    </section>

    <section className='workspacePanel'>
      <header><div><span>UNIVERSITY EXCEPTIONS</span><h2>Recorded overrides</h2></div><strong>{scopedOverrides.length} records</strong></header>
      {loading?<div className='empty'>Loading university overrides…</div>:scopedOverrides.length===0?<div className='empty'><h3>No overrides yet</h3><p>The mapped national Freshman structure remains the default.</p></div>:
      <div className='overrideList'>{scopedOverrides.map(item=><article className='overrideCard' key={item.id}>
        <div className='overrideIcon'>{item.override_type==='ADD'?'＋':item.override_type==='REMOVE'?'−':item.override_type==='MOVE'?'↕':item.override_type==='CHANGE_STREAM'?'⇄':'✎'}</div>
        <div className='overrideBody'>
          <b>{item.override_type.replace('_',' ')}</b>
          <h3>{item.national_course_code||item.local_course_code||'University course'} · {item.national_course_name||item.local_course_name||'Local course'}</h3>
          <p>{item.source_stream_name||'All streams'} {item.target_stream_name?'→ '+item.target_stream_name:''}{item.semester_number?' · Semester '+item.semester_number:''}</p>
          <small>{item.reason}{item.source?' · '+item.source:''}</small>
        </div>
        <div className='overrideMeta'><span className={item.status==='ACTIVE'?'workspaceStatusActive':'workspaceStatus'}>{item.status}</span><button onClick={()=>startEdit(item)}>Edit</button><button className='danger' onClick={()=>remove(item.id)}>Delete</button></div>
      </article>)}</div>}
    </section>
  </div>
}
