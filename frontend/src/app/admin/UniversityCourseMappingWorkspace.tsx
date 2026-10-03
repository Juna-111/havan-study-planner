'use client'

import {useEffect,useMemo,useState} from 'react'
import {apiFetch} from '../../lib/api'

type University={id:number;name:string;code:string}
type Curriculum={id:number;university_id:number;name:string;version:string;status:string}
type Stream={id:number;curriculum_id:number;name:string;code:string;status:string}
type Course={id:number;code:string;name:string;credit_hours:number|null;academic_scope:string;status:string}
type Mapping={
  id:number
  curriculum_id:number
  curriculum_name:string
  curriculum_version:string
  university_id:number
  university_name:string
  stream_id:number
  stream_name:string
  stream_code:string
  course_id:number
  course_code:string
  course_name:string
  credit_hours:number|null
  semester_number:number
  order_index:number
  status:string
}

export default function UniversityCourseMappingWorkspace(){
  const [universities,setUniversities]=useState<University[]>([])
  const [curriculums,setCurriculums]=useState<Curriculum[]>([])
  const [streams,setStreams]=useState<Stream[]>([])
  const [courses,setCourses]=useState<Course[]>([])
  const [mappings,setMappings]=useState<Mapping[]>([])
  const [universityId,setUniversityId]=useState('')
  const [curriculumId,setCurriculumId]=useState('')
  const [streamId,setStreamId]=useState('')
  const [search,setSearch]=useState('')
  const [loading,setLoading]=useState(true)
  const [savingId,setSavingId]=useState<number|null>(null)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  async function load(){
    setLoading(true)
    setError('')
    try{
      const [u,c,s,available]=await Promise.all([
        apiFetch<{items:University[]}>('/universities?page=1&page_size=100'),
        apiFetch<{items:Curriculum[]}>('/curriculums?page=1&page_size=100'),
        apiFetch<{items:Stream[]}>('/streams?page=1&page_size=100'),
        apiFetch<Course[]>('/university-course-mappings/courses?status_filter=ACTIVE')
      ])
      setUniversities(u.items)
      setCurriculums(c.items)
      setStreams(s.items)
      setCourses(available)
      if(!universityId&&u.items[0])setUniversityId(String(u.items[0].id))
    }catch(err){
      setError(err instanceof Error?err.message:'Could not load university course mapping.')
    }finally{
      setLoading(false)
    }
  }

  async function loadMappings(nextStreamId=streamId){
    if(!nextStreamId){
      setMappings([])
      return
    }
    try{
      const rows=await apiFetch<Mapping[]>('/university-course-mappings?stream_id='+nextStreamId)
      setMappings(rows)
    }catch(err){
      setError(err instanceof Error?err.message:'Could not load mapped courses.')
    }
  }

  useEffect(()=>{load()},[])

  const universityCurriculums=useMemo(
    ()=>curriculums.filter(item=>String(item.university_id)===universityId),
    [curriculums,universityId]
  )

  const curriculumStreams=useMemo(
    ()=>streams.filter(item=>String(item.curriculum_id)===curriculumId && item.status==='ACTIVE'),
    [streams,curriculumId]
  )

  const selectedUniversity=universities.find(item=>String(item.id)===universityId)
  const selectedCurriculum=curriculums.find(item=>String(item.id)===curriculumId)
  const selectedStream=streams.find(item=>String(item.id)===streamId)

  useEffect(()=>{
    const next=universityCurriculums.find(item=>item.status==='ACTIVE')||universityCurriculums[0]
    if(next&&String(next.id)!==curriculumId)setCurriculumId(String(next.id))
    if(!next)setCurriculumId('')
  },[universityCurriculums,curriculumId])

  useEffect(()=>{
    const next=curriculumStreams[0]
    if(next&&String(next.id)!==streamId)setStreamId(String(next.id))
    if(!next)setStreamId('')
  },[curriculumStreams,streamId])

  useEffect(()=>{
    loadMappings()
  },[streamId])

  const mappedIds=useMemo(()=>new Set(mappings.map(item=>item.course_id)),[mappings])

  const filteredCourses=useMemo(()=>{
    const term=search.trim().toLowerCase()
    if(!term)return courses
    return courses.filter(item=>
      item.code.toLowerCase().includes(term)||item.name.toLowerCase().includes(term)
    )
  },[courses,search])

  const semesterOne=mappings.filter(item=>item.semester_number===1).sort((a,b)=>a.order_index-b.order_index)
  const semesterTwo=mappings.filter(item=>item.semester_number===2).sort((a,b)=>a.order_index-b.order_index)

  async function addCourse(course:Course,semester:number){
    if(!streamId)return
    setSavingId(course.id);setError('');setMessage('')
    try{
      const highest=Math.max(
        0,
        ...mappings.filter(item=>item.semester_number===semester).map(item=>item.order_index)
      )
      const created=await apiFetch<Mapping>('/university-course-mappings',{
        method:'POST',
        body:JSON.stringify({
          stream_id:Number(streamId),
          course_id:course.id,
          semester_number:semester,
          order_index:highest+1,
          status:'ACTIVE'
        })
      })
      setMappings(items=>[...items,created])
      setMessage(course.code+' added to Semester '+semester+'.')
    }catch(err){
      setError(err instanceof Error?err.message:'Could not add this course.')
    }finally{
      setSavingId(null)
    }
  }

  async function moveCourse(item:Mapping){
    const target=item.semester_number===1?2:1
    setSavingId(item.course_id);setError('');setMessage('')
    try{
      const highest=Math.max(
        0,
        ...mappings.filter(row=>row.semester_number===target).map(row=>row.order_index)
      )
      const updated=await apiFetch<Mapping>('/university-course-mappings/'+item.id,{
        method:'PATCH',
        body:JSON.stringify({semester_number:target,order_index:highest+1})
      })
      setMappings(items=>items.map(row=>row.id===updated.id?updated:row))
      setMessage(item.course_code+' moved to Semester '+target+'.')
    }catch(err){
      setError(err instanceof Error?err.message:'Could not move this course.')
    }finally{
      setSavingId(null)
    }
  }

  async function removeCourse(item:Mapping){
    setSavingId(item.course_id);setError('');setMessage('')
    try{
      await apiFetch('/university-course-mappings/'+item.id,{method:'DELETE'})
      setMappings(items=>items.filter(row=>row.id!==item.id))
      setMessage(item.course_code+' removed from this university stream. The course remains in the course catalog.')
    }catch(err){
      setError(err instanceof Error?err.message:'Could not remove this course.')
    }finally{
      setSavingId(null)
    }
  }

  function semesterCard(item:Mapping){
    const busy=savingId===item.course_id
    return <article className='overrideCard' key={item.id}>
      <div className='overrideIcon'>{item.semester_number}</div>
      <div className='overrideBody'>
        <b>{item.course_code}</b>
        <h3>{item.course_name}</h3>
        <p>{item.credit_hours!=null?item.credit_hours+' credits':'Credits not set'} · Semester {item.semester_number}</p>
      </div>
      <div className='overrideMeta'>
        <button disabled={busy} onClick={()=>moveCourse(item)}>{busy?'Saving…':'Move to Sem '+(item.semester_number===1?2:1)}</button>
        <button className='danger' disabled={busy} onClick={()=>removeCourse(item)}>Remove</button>
      </div>
    </article>
  }

  return <div className='workspacePage'>
    <header className='workspaceHeader'>
      <div>
        <span>HAVAN UNIVERSITY ACADEMIC SETUP</span>
        <h1>University course mapping</h1>
        <p>Select the courses this university actually teaches in Semester 1 and Semester 2. The course catalog remains unchanged; this workspace only defines university placement.</p>
      </div>
    </header>

    {message&&<div className='notice workspaceNotice'>{message}</div>}
    {error&&<div className='alert workspaceNotice'>{error}<button onClick={()=>setError('')}>×</button></div>}

    <section className='workspaceGrid'>
      <div className='workspaceCard'>
        <h3>1. Choose the university</h3>
        <label><span>University</span><select value={universityId} onChange={e=>setUniversityId(e.target.value)}>
          <option value=''>Select university…</option>
          {universities.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select></label>
        <label><span>Curriculum</span><select value={curriculumId} onChange={e=>setCurriculumId(e.target.value)}>
          <option value=''>Select curriculum…</option>
          {universityCurriculums.map(item=><option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}
        </select></label>
        <label><span>Stream</span><select value={streamId} onChange={e=>setStreamId(e.target.value)}>
          <option value=''>Select stream…</option>
          {curriculumStreams.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select></label>
        {selectedUniversity&&selectedCurriculum&&selectedStream&&
          <div className='workspaceBaseline'>
            <b>{selectedUniversity.name}</b>
            <span>{selectedCurriculum.name} · {selectedCurriculum.version}</span>
            <small>{selectedStream.name} · choose only the courses actually taught by this stream</small>
          </div>
        }
      </div>

      <div className='workspaceCard'>
        <h3>2. Add courses</h3>
        <p className='muted'>Every active course is available here, whether it is currently mapped to a semester or not.</p>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='Search by course code or name…'/>
        <div className='workspaceList'>
          {filteredCourses.map(course=>{
            const mapped=mappedIds.has(course.id)
            const busy=savingId===course.id
            return <div className='overrideCard' key={course.id}>
              <div className='overrideBody'>
                <b>{course.code}</b>
                <h3>{course.name}</h3>
                <p>{course.credit_hours!=null?course.credit_hours+' credits':'Credits not set'} · {course.academic_scope}</p>
              </div>
              <div className='overrideMeta'>
                {mapped?<span className='workspaceStatusActive'>MAPPED</span>:<>
                  <button disabled={!streamId||busy} onClick={()=>addCourse(course,1)}>{busy?'Saving…':'+ Semester 1'}</button>
                  <button disabled={!streamId||busy} onClick={()=>addCourse(course,2)}>+ Semester 2</button>
                </>}
              </div>
            </div>
          })}
          {!filteredCourses.length&&<div className='empty'><h3>No courses found</h3><p>Try another course code or name.</p></div>}
        </div>
      </div>
    </section>

    <section className='workspacePanel'>
      <header>
        <div>
          <span>UNIVERSITY COURSE STRUCTURE</span>
          <h2>{selectedStream?selectedStream.name:'Select a stream'}</h2>
        </div>
        <strong>{mappings.length} mapped courses</strong>
      </header>

      {!selectedStream?<div className='empty'><h3>Select a university stream</h3><p>The semester mapping will appear here.</p></div>:
      loading?<div className='empty'>Loading university structure…</div>:
      <div className='workspaceSemesterGrid'>
        <article className='workspaceSemester'>
          <header><div><small>SEMESTER 1</small><h3>First semester</h3></div><span>{semesterOne.length} courses</span></header>
          <div className='overrideList'>
            {semesterOne.map(semesterCard)}
            {!semesterOne.length&&<div className='empty'><p>No courses mapped yet.</p></div>}
          </div>
        </article>
        <article className='workspaceSemester'>
          <header><div><small>SEMESTER 2</small><h3>Second semester</h3></div><span>{semesterTwo.length} courses</span></header>
          <div className='overrideList'>
            {semesterTwo.map(semesterCard)}
            {!semesterTwo.length&&<div className='empty'><p>No courses mapped yet.</p></div>}
          </div>
        </article>
      </div>}
    </section>
  </div>
}
