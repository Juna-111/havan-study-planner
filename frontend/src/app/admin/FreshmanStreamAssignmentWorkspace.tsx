'use client'

import {useEffect,useMemo,useState} from 'react'
import {apiFetch} from '../../lib/api'

type University={id:number;name:string;code:string}
type Curriculum={id:number;university_id:number;name:string;version:string;academic_year?:string|null;status:string}
type Stream={id:number;curriculum_id:number;name:string;code:string;status:string}
type Mapping={id:number;curriculum_id:number;curriculum_name:string;curriculum_version:string;university_id:number;university_name:string;template_id:number;template_code:string;template_name:string;template_version:string;template_academic_year?:string|null;status:string}
type Placement={id:number;semester_id:number;course_id:number;course_code:string;course_name:string;requirement_type:string;order_index:number;notes?:string|null}
type Semester={id:number;template_id:number;semester_number:number;name:string;description?:string|null;courses:Placement[]}
type Template={id:number;code:string;name:string;version:string;academic_year?:string|null;status:string;semesters:Semester[]}
type Assignment={id:number;stream_id:number;stream_name:string;stream_code:string;curriculum_id:number;curriculum_name:string;university_id:number;university_name:string;template_course_id:number;semester_number:number;semester_name:string;course_id:number;course_code:string;course_name:string;requirement_type:string;order_index:number;status:string;notes?:string|null}

export default function FreshmanStreamAssignmentWorkspace(){
  const [universities,setUniversities]=useState<University[]>([])
  const [curriculums,setCurriculums]=useState<Curriculum[]>([])
  const [streams,setStreams]=useState<Stream[]>([])
  const [mappings,setMappings]=useState<Mapping[]>([])
  const [assignments,setAssignments]=useState<Assignment[]>([])
  const [template,setTemplate]=useState<Template|null>(null)
  const [universityId,setUniversityId]=useState('')
  const [curriculumId,setCurriculumId]=useState('')
  const [streamId,setStreamId]=useState('')
  const [status,setStatus]=useState('DRAFT')
  const [busyId,setBusyId]=useState<number|null>(null)
  const [loading,setLoading]=useState(true)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  async function load(){
    setLoading(true);setError('')
    try{
      const [u,c,s,m,a]=await Promise.all([
        apiFetch<{items:University[]}>('/universities?page=1&page_size=100'),
        apiFetch<{items:Curriculum[]}>('/curriculums?page=1&page_size=100'),
        apiFetch<{items:Stream[]}>('/streams?page=1&page_size=100'),
        apiFetch<Mapping[]>('/freshman-mappings'),
        apiFetch<Assignment[]>('/freshman-stream-assignments')
      ])
      setUniversities(u.items);setCurriculums(c.items);setStreams(s.items);setMappings(m);setAssignments(a)
      if(!universityId&&u.items[0])setUniversityId(String(u.items[0].id))
    }catch(err){setError(err instanceof Error?err.message:'Could not load Freshman stream assignments.')}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[])

  const universityCurriculums=useMemo(
    ()=>curriculums.filter(item=>String(item.university_id)===universityId),
    [curriculums,universityId]
  )

  const mappedCurriculums=useMemo(
    ()=>universityCurriculums.filter(item=>mappings.some(m=>m.curriculum_id===item.id)),
    [universityCurriculums,mappings]
  )

  const curriculumStreams=useMemo(
    ()=>streams.filter(item=>String(item.curriculum_id)===curriculumId&&item.status==='ACTIVE'),
    [streams,curriculumId]
  )

  const mapping=mappings.find(item=>item.curriculum_id===Number(curriculumId))
  const selectedStream=curriculumStreams.find(item=>String(item.id)===streamId)

  useEffect(()=>{
    if(!mappedCurriculums.some(item=>String(item.id)===curriculumId)){
      setCurriculumId(mappedCurriculums[0]?.id.toString()??'')
    }
  },[mappedCurriculums,curriculumId])

  useEffect(()=>{
    if(!curriculumStreams.some(item=>String(item.id)===streamId)){
      setStreamId(curriculumStreams[0]?.id.toString()??'')
    }
  },[curriculumStreams,streamId])

  useEffect(()=>{
    if(mapping){
      setStatus(mapping.status==='ACTIVE'?'ACTIVE':'DRAFT')
      apiFetch<Template>('/freshman-templates/'+mapping.template_id)
        .then(setTemplate)
        .catch(err=>setError(err instanceof Error?err.message:'Could not load the national Freshman template.'))
    }else{
      setTemplate(null)
    }
  },[mapping?.id,mapping?.template_id,mapping?.status])

  const streamAssignments=useMemo(
    ()=>assignments.filter(item=>item.stream_id===Number(streamId)),
    [assignments,streamId]
  )
  const assignedIds=useMemo(
    ()=>new Set(streamAssignments.map(item=>item.template_course_id)),
    [streamAssignments]
  )

  async function assignCourse(placement:Placement){
    if(!streamId||!mapping)return
    const assignmentStatus=status==='ACTIVE'?'ACTIVE':'DRAFT'
    setBusyId(placement.id);setError('');setMessage('')
    try{
      const created=await apiFetch<Assignment>('/freshman-stream-assignments',{
        method:'POST',
        body:JSON.stringify({
          stream_id:Number(streamId),
          template_course_id:placement.id,
          status:assignmentStatus
        })
      })
      setAssignments(items=>[created,...items])
      setMessage(placement.course_code+' assigned to '+(selectedStream?.name??'stream')+'.')
    }catch(err){setError(err instanceof Error?err.message:'Could not assign this Freshman course.')}
    finally{setBusyId(null)}
  }

  async function removeAssignment(placementId:number){
    const current=streamAssignments.find(item=>item.template_course_id===placementId)
    if(!current)return
    setBusyId(placementId);setError('');setMessage('')
    try{
      await apiFetch('/freshman-stream-assignments/'+current.id,{method:'DELETE'})
      setAssignments(items=>items.filter(item=>item.id!==current.id))
      setMessage('Freshman course removed from this stream. The national course remains unchanged.')
    }catch(err){setError(err instanceof Error?err.message:'Could not remove this assignment.')}
    finally{setBusyId(null)}
  }

  return <div className='workspacePage'>
    <header className='workspaceHeader'>
      <div>
        <span>HAVAN FRESHMAN STRUCTURE</span>
        <h1>Stream course assignment</h1>
        <p>Give each university Freshman stream the national courses it actually takes. Havan references the national course hierarchy instead of copying it.</p>
      </div>
    </header>

    {message&&<div className='notice workspaceNotice'>{message}</div>}
    {error&&<div className='alert workspaceNotice'>{error}<button onClick={()=>setError('')}>×</button></div>}

    <section className='workspaceGrid'>
      <div className='workspaceCard'>
        <h3>1. Choose the university stream</h3>
        <p className='muted'>Only curriculum versions that already have a national Freshman mapping are available.</p>
        <label><span>University</span><select value={universityId} onChange={e=>setUniversityId(e.target.value)}><option value=''>Select university…</option>{universities.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label><span>Mapped curriculum</span><select value={curriculumId} onChange={e=>setCurriculumId(e.target.value)}><option value=''>Select curriculum…</option>{mappedCurriculums.map(item=><option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></label>
        <label><span>Freshman stream</span><select value={streamId} onChange={e=>setStreamId(e.target.value)}><option value=''>Select stream…</option>{curriculumStreams.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
      </div>

      <div className='workspaceCard'>
        <h3>2. Confirm the national baseline</h3>
        {!mapping?<p className='muted'>No national Freshman mapping exists for this curriculum yet.</p>:<>
          <div className='workspaceBaseline'><b>{mapping.template_code} · v{mapping.template_version}</b><span>{mapping.template_name}</span><small>Mapping: {mapping.status}</small></div>
          <label><span>Assignment status</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value='DRAFT'>Draft</option><option value='ACTIVE'>Active</option></select></label>
          <div className='workspaceMeta'>The course, chapter and topic content stays in the national registry. This step only says which national courses this university stream takes.</div>
        </>}
      </div>
    </section>

    <section className='workspacePanel'>
      <header><div><span>SEMESTER COURSE SELECTION</span><h2>{selectedStream?selectedStream.name:'Select a stream'}</h2></div><strong>{streamAssignments.length} assigned</strong></header>
      {!selectedStream?<div className='empty'><h3>Select a Freshman stream</h3><p>Choose a mapped curriculum and stream above.</p></div>:
      loading?<div className='empty'>Loading national course structure…</div>:
      !template?<div className='empty'><h3>National template unavailable</h3><p>The curriculum mapping could not be loaded.</p></div>:
      <div className='workspaceSemesterGrid'>{template.semesters.map(semester=><article className='workspaceSemester' key={semester.id}>
        <header><div><small>SEMESTER {semester.semester_number}</small><h3>{semester.name}</h3></div><span>{semester.courses.length} national courses</span></header>
        <div className='workspaceCourseList'>{semester.courses.map(course=>{
          const assigned=assignedIds.has(course.id)
          const busy=busyId===course.id
          return <div className={assigned?'workspaceCourse assigned':'workspaceCourse'} key={course.id}>
            <div><b>{course.course_code}</b><strong>{course.course_name}</strong><small>{course.requirement_type} · order {course.order_index}</small></div>
            {assigned?<button className='workspaceAssigned' disabled={busy} onClick={()=>removeAssignment(course.id)}>{busy?'Saving…':'✓ Assigned'}</button>:<button className='workspaceAdd' disabled={busy} onClick={()=>assignCourse(course)}>{busy?'Adding…':'+ Add to stream'}</button>}
          </div>
        })}</div>
      </article>)}</div>}
    </section>
  </div>
}
