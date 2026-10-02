'use client'

import {useEffect, useState} from 'react'
import {apiFetch} from '../../lib/api'

type Course={id:number;code:string;name:string;content_version:string;category_codes:string[]}
type Placement={id:number;semester_id:number;course_id:number;course_code:string;course_name:string;requirement_type:string;order_index:number;notes?:string|null}
type Semester={id:number;template_id:number;semester_number:number;name:string;description?:string|null;courses:Placement[]}
type Template={id:number;code:string;name:string;version:string;academic_year?:string|null;description?:string|null;status:string;semesters:Semester[]}

export default function FreshmanTemplateWorkspace(){
  const [templates,setTemplates]=useState<Template[]>([])
  const [courses,setCourses]=useState<Course[]>([])
  const [selected,setSelected]=useState<Template|null>(null)
  const [form,setForm]=useState({code:'NATIONAL-2026',name:'National Freshman Curriculum',version:'1.0',academic_year:'2026/27',description:'',status:'DRAFT'})
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [assignment,setAssignment]=useState({semester_number:'1',course_id:'',requirement_type:'REQUIRED',order_index:'1',notes:''})

  async function load(){
    try{
      const [nextTemplates,nextCourses]=await Promise.all([
        apiFetch<Template[]>('/freshman-templates'),
        apiFetch<Course[]>('/freshman-registry/courses')
      ])
      setTemplates(nextTemplates)
      setCourses(nextCourses)
      setSelected(current=>current?nextTemplates.find(item=>item.id===current.id)??null:nextTemplates[0]??null)
    }catch(err){setError(err instanceof Error?err.message:'Could not load Freshman templates.')}
  }

  useEffect(()=>{load()},[])

  async function createTemplate(){
    setBusy(true);setError('');setMessage('')
    try{
      const body={
        ...form,
        semesters:[
          {semester_number:1,name:'Semester I',courses:[]},
          {semester_number:2,name:'Semester II',courses:[]}
        ]
      }
      const created=await apiFetch<Template>('/freshman-templates',{method:'POST',body:JSON.stringify(body)})
      setTemplates(items=>[...items,created])
      setSelected(created)
      setMessage('Freshman curriculum template created.')
    }catch(err){setError(err instanceof Error?err.message:'Could not create the template.')}
    finally{setBusy(false)}
  }

  async function assignCourse(){
    if(!selected||!assignment.course_id){setError('Select a Freshman registry course first.');return}
    setBusy(true);setError('');setMessage('')
    try{
      const updated=await apiFetch<Template>(`/freshman-templates/${selected.id}/courses`,{
        method:'POST',
        body:JSON.stringify({
          semester_number:Number(assignment.semester_number),
          course_id:Number(assignment.course_id),
          requirement_type:assignment.requirement_type,
          order_index:Number(assignment.order_index),
          notes:assignment.notes||null
        })
      })
      setSelected(updated)
      setTemplates(items=>items.map(item=>item.id===updated.id?updated:item))
      setAssignment({...assignment,course_id:'',notes:''})
      setMessage('Registry course assigned without copying its content.')
    }catch(err){setError(err instanceof Error?err.message:'Could not assign the course.')}
    finally{setBusy(false)}
  }

  async function removeCourse(placementId:number){
    if(!selected)return
    setBusy(true);setError('');setMessage('')
    try{
      await apiFetch(`/freshman-templates/${selected.id}/courses/${placementId}`,{method:'DELETE'})
      const updated=await apiFetch<Template>(`/freshman-templates/${selected.id}`)
      setSelected(updated)
      setTemplates(items=>items.map(item=>item.id===updated.id?updated:item))
      setMessage('Course removed from the template. The national registry content remains unchanged.')
    }catch(err){setError(err instanceof Error?err.message:'Could not remove the course.')}
    finally{setBusy(false)}
  }

  return <div className='workspacePage'>
    <header className='workspaceHeader'>
      <div><span>HAVAN ACADEMIC TEMPLATES</span><h1>Freshman curriculum templates</h1><p className='muted'>Build national Semester I and Semester II baselines from reusable registry courses. Universities are not mapped here.</p></div>
    </header>
    {message&&<div className='notice importNotice'>{message}</div>}
    {error&&<div className='alert importNotice'>{error}<button onClick={()=>setError('')}>×</button></div>}

    <section className='workspaceGrid'>
      <div className='workspaceCard'>
        <h3>1. Create a template</h3>
        <p className='muted'>The same template code can have multiple versions, but each code + version must be unique.</p>
        {(['code','name','version','academic_year'] as const).map(key=><label key={key}><span>{key==='academic_year'?'Academic year':key.replace('_',' ')}</span><input value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
        <label><span>Description</span><textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
        <button className='primary importButton' disabled={busy} onClick={createTemplate}>{busy?'Saving…':'Create two-semester template'}</button>
      </div>

      <div className='workspaceCard'>
        <h3>2. Assign registry courses</h3>
        <p className='muted'>A course is referenced by ID. Its Chapter → Topic content is never duplicated into the template.</p>
        {selected?<><label><span>Template</span><select value={String(selected.id)} onChange={e=>setSelected(templates.find(item=>item.id===Number(e.target.value))??null)}>{templates.map(item=><option key={item.id} value={item.id}>{item.code} · v{item.version}</option>)}</select></label>
        <label><span>Semester</span><select value={assignment.semester_number} onChange={e=>setAssignment({...assignment,semester_number:e.target.value})}><option value='1'>Semester I</option><option value='2'>Semester II</option></select></label>
        <label><span>Freshman registry course</span><select value={assignment.course_id} onChange={e=>setAssignment({...assignment,course_id:e.target.value})}><option value=''>Select course…</option>{courses.map(course=><option key={course.id} value={course.id}>{course.code} · {course.name} · v{course.content_version}</option>)}</select></label>
        <label><span>Requirement</span><select value={assignment.requirement_type} onChange={e=>setAssignment({...assignment,requirement_type:e.target.value})}><option value='REQUIRED'>Required</option><option value='ELECTIVE'>Elective</option></select></label>
        <label><span>Order</span><input type='number' min='1' value={assignment.order_index} onChange={e=>setAssignment({...assignment,order_index:e.target.value})}/></label>
        <button className='primary importButton' disabled={busy||!assignment.course_id} onClick={assignCourse}>{busy?'Saving…':'Assign course'}</button>
        </>:<div className='empty'><h3>Create the first template</h3><p>Then assign reusable Freshman registry courses to either semester.</p></div>}
      </div>
    </section>

    <section className='workspacePanel'>
      <header><div><span>VERSIONED NATIONAL BASELINE</span><h2>{selected?selected.name:'Freshman templates'}</h2></div><strong>{templates.length} templates</strong></header>
      {selected?<div className='workspaceGrid'>{selected.semesters.map(semester=><div className='workspaceCard' key={semester.id}><h3>{semester.name}</h3><p className='muted'>{semester.courses.length} referenced courses</p>{semester.courses.length===0?<div className='empty'>No courses assigned.</div>:semester.courses.map(course=><div className='workspacePlacement' key={course.id}><b>{course.course_code} · {course.course_name}</b><span>{course.requirement_type} · order {course.order_index}</span><button className='danger' disabled={busy} onClick={()=>removeCourse(course.id)}>Remove from template</button></div>)}</div>)}</div>:<div className='empty'>No Freshman curriculum templates yet.</div>}
    </section>
  </div>
}
