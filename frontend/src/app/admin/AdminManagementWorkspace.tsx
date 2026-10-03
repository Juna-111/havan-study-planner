'use client'

import {useEffect,useMemo,useState} from 'react'
import {apiFetch} from '../../lib/api'
import './management.css'
import UniversityCourseMappingWorkspace from './UniversityCourseMappingWorkspace'

type University={id:number;name:string;code:string;description:string|null;status:string}
type Curriculum={id:number;university_id:number;name:string;version:string;academic_year:string|null;description:string|null;status:string}
type Stream={id:number;curriculum_id:number;name:string;code:string;description:string|null;status:string}
type Course={id:number;stream_id:number|null;code:string;name:string;description:string|null;credit_hours:number|null;status:string}
type Chapter={id:number;course_id:number;name:string;description:string|null;order_index:number;status:string}
type Topic={id:number;chapter_id:number;name:string;description:string|null;difficulty:number;estimated_study_minutes:number;exam_importance:number;conceptual_importance:number;order_index:number;status:string}
type Relationship={id:number;source_topic_id:number;target_topic_id:number;relationship_type:string;strength:number;notes:string|null}

type Section='universities'|'curricula'|'streams'|'courses'|'chapters'|'topics'|'mappings'|'relationships'
const labels:Record<Section,string>={
  universities:'Universities',curricula:'Curricula',streams:'Streams',courses:'Courses',
  chapters:'Chapters',topics:'Topics',mappings:'Course mappings',relationships:'Topic relationships'
}
const masterSections:Section[]=['universities','curricula','streams','courses','chapters','topics']
const statusOptions:Record<Section,string[]>={
  universities:['ACTIVE','INACTIVE'],curricula:['DRAFT','ACTIVE','ARCHIVED'],streams:['ACTIVE','INACTIVE'],
  courses:['ACTIVE','INACTIVE'],chapters:['ACTIVE','INACTIVE'],topics:['ACTIVE','INACTIVE'],
  mappings:[],relationships:[]
}

export default function AdminManagementWorkspace(){
  const [section,setSection]=useState<Section>('universities')
  const [universities,setUniversities]=useState<University[]>([])
  const [curricula,setCurricula]=useState<Curriculum[]>([])
  const [streams,setStreams]=useState<Stream[]>([])
  const [courses,setCourses]=useState<Course[]>([])
  const [chapters,setChapters]=useState<Chapter[]>([])
  const [topics,setTopics]=useState<Topic[]>([])
  const [relationships,setRelationships]=useState<Relationship[]>([])
  const [universityId,setUniversityId]=useState('')
  const [curriculumId,setCurriculumId]=useState('')
  const [streamId,setStreamId]=useState('')
  const [courseId,setCourseId]=useState('')
  const [chapterId,setChapterId]=useState('')
  const [search,setSearch]=useState('')
  const [page,setPage]=useState(1)
  const [pages,setPages]=useState(0)
  const [total,setTotal]=useState(0)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [editing,setEditing]=useState<number|null>(null)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [form,setForm]=useState<Record<string,string>>({})

  const setValue=(key:string,value:string)=>setForm(x=>({...x,[key]:value}))
  const clearForm=()=>{setEditing(null);setForm({})}

  async function loadReferenceData(){
    const [u,c,s,co,ch,t]=await Promise.all([
      apiFetch<{items:University[]}>('/universities?page=1&page_size=100'),
      apiFetch<{items:Curriculum[]}>('/curriculums?page=1&page_size=100'),
      apiFetch<{items:Stream[]}>('/streams?page=1&page_size=100'),
      apiFetch<{items:Course[]}>('/courses?page=1&page_size=100'),
      apiFetch<{items:Chapter[]}>('/chapters?page=1&page_size=100'),
      apiFetch<{items:Topic[]}>('/topics?page=1&page_size=100')
    ])
    setUniversities(u.items);setCurricula(c.items);setStreams(s.items);setCourses(co.items);setChapters(ch.items);setTopics(t.items)
  }

  async function loadSection(nextPage=page){
    setLoading(true);setError('')
    try{
      if(section==='relationships'){
        const result=await apiFetch<{items:Relationship[];page:number;pages:number;total:number}>('/topic-relationships?page='+nextPage+'&page_size=20')
        setRelationships(result.items);setPage(result.page);setPages(result.pages);setTotal(result.total);return
      }
      const endpoint=section==='curricula'?'curriculums':section
      const params=new URLSearchParams({page:String(nextPage),page_size:'20'})
      if(section==='curricula'&&universityId)params.set('university_id',universityId)
      if(section==='streams'&&curriculumId)params.set('curriculum_id',curriculumId)
      if(section==='courses'&&streamId)params.set('stream_id',streamId)
      if(section==='chapters'&&courseId)params.set('course_id',courseId)
      if(section==='topics'&&chapterId)params.set('chapter_id',chapterId)
      const result=await apiFetch<{items:any[];page:number;pages:number;total:number}>('/'+endpoint+'?'+params)
      const items=result.items
      if(section==='universities')setUniversities(items)
      if(section==='curricula')setCurricula(items)
      if(section==='streams')setStreams(items)
      if(section==='courses')setCourses(items)
      if(section==='chapters')setChapters(items)
      if(section==='topics')setTopics(items)
      setPage(result.page);setPages(result.pages);setTotal(result.total)
    }catch(e){setError(e instanceof Error?e.message:'Could not load management data.')}
    finally{setLoading(false)}
  }

  useEffect(()=>{loadReferenceData().catch(e=>setError(e instanceof Error?e.message:'Could not load academic references.'))},[])
  useEffect(()=>{setPage(1);setEditing(null);setForm({});setSearch('');loadSection(1)},[section,universityId,curriculumId,streamId,courseId,chapterId])

  const currentRows=useMemo<any[]>(()=>{
    if(section==='relationships')return relationships
    if(section==='universities')return universities
    if(section==='curricula')return curricula
    if(section==='streams')return streams
    if(section==='courses')return courses
    if(section==='chapters')return chapters
    return topics
  },[section,universities,curricula,streams,courses,chapters,topics,relationships])

  const filtered=currentRows.filter(item=>{
    const term=search.trim().toLowerCase()
    if(!term)return true
    return JSON.stringify(item).toLowerCase().includes(term)
  })

  function beginEdit(item:any){
    setEditing(item.id)
    if('university_id' in item)setUniversityId(String(item.university_id))
    if('curriculum_id' in item)setCurriculumId(String(item.curriculum_id))
    if('stream_id' in item)setStreamId(String(item.stream_id))
    if('course_id' in item)setCourseId(String(item.course_id))
    if('chapter_id' in item)setChapterId(String(item.chapter_id))
    const next:Record<string,string>={}
    Object.entries(item).forEach(([key,value])=>{
      if(!['id','created_at','updated_at','registry_key','academic_scope','university_name','curriculum_name','curriculum_version','stream_name','stream_code','course_code','course_name','credit_hours'].includes(key)&&value!==null)next[key]=String(value)
    })
    if(section==='relationships'){next.source_topic_id=String(item.source_topic_id);next.target_topic_id=String(item.target_topic_id)}
    setForm(next)
  }

  function parentMissing(){
    return (section==='curricula'&&!universityId)||(section==='streams'&&!curriculumId)||(section==='courses'&&!streamId)||
      (section==='chapters'&&!courseId)||(section==='topics'&&!chapterId)
  }

  function payload(){
    if(section==='universities')return {name:form.name||'',code:form.code||'',description:form.description||'',status:form.status||'ACTIVE'}
    if(section==='curricula')return {university_id:Number(universityId),name:form.name||'',version:form.version||'',academic_year:form.academic_year||'',description:form.description||'',status:form.status||'DRAFT'}
    if(section==='streams')return {curriculum_id:Number(curriculumId),name:form.name||'',code:form.code||'',description:form.description||'',status:form.status||'ACTIVE'}
    if(section==='courses')return {stream_id:Number(streamId),code:form.code||'',name:form.name||'',description:form.description||'',credit_hours:form.credit_hours?Number(form.credit_hours):null,status:form.status||'ACTIVE'}
    if(section==='chapters')return {course_id:Number(courseId),name:form.name||'',description:form.description||'',order_index:Number(form.order_index||1),status:form.status||'ACTIVE'}
    if(section==='topics')return {chapter_id:Number(chapterId),name:form.name||'',description:form.description||'',difficulty:Number(form.difficulty||3),estimated_study_minutes:Number(form.estimated_study_minutes||60),exam_importance:Number(form.exam_importance||0.5),conceptual_importance:Number(form.conceptual_importance||0.5),order_index:Number(form.order_index||1),status:form.status||'ACTIVE'}
    return {source_topic_id:Number(form.source_topic_id),target_topic_id:Number(form.target_topic_id),relationship_type:form.relationship_type||'prerequisite',strength:Number(form.strength||1),notes:form.notes||''}
  }

  const endpoint=section==='curricula'?'curriculums':section==='relationships'?'topic-relationships':section

  async function save(){
    if(parentMissing()){setError('Choose the parent record before creating this item.');return}
    if(section==='relationships'&&(!form.source_topic_id||!form.target_topic_id)){setError('Choose both source and target topics.');return}
    if(section==='relationships'&&form.source_topic_id===form.target_topic_id){setError('A topic cannot relate to itself.');return}
    setSaving(true);setError('');setMessage('')
    try{
      const result=await apiFetch<any>(editing?'/'+endpoint+'/'+editing:'/'+endpoint,{method:editing?'PATCH':'POST',body:JSON.stringify(payload())})
      setMessage((editing?'Updated ':'Created ')+labels[section].slice(0,-1)+'.')
      clearForm()
      await loadReferenceData()
      await loadSection(page)
    }catch(e){setError(e instanceof Error?e.message:'Could not save this record.')}
    finally{setSaving(false)}
  }

  async function archive(item:any){
    const archiveStatus=section==='curricula'?'ARCHIVED':'INACTIVE'
    const action=item.status==='ACTIVE'?'deactivate':'archive'
    if(item.status!=='ACTIVE'&&item.status!=='DRAFT'&&item.status!=='ARCHIVED'){
      setError('This record cannot be changed from its current state.');return
    }
    if(!window.confirm((action==='deactivate'?'Deactivate ':'Archive ')+displayName(item)+'? It will remain in the database and can be restored later.'))return
    setError('');setMessage('')
    try{
      await apiFetch('/'+endpoint+'/'+item.id,{method:'PATCH',body:JSON.stringify({status:archiveStatus})})
      setMessage(displayName(item)+' is now '+archiveStatus.toLowerCase()+'.')
      if(editing===item.id)clearForm()
      await loadReferenceData();await loadSection(page)
    }catch(e){setError(e instanceof Error?e.message:'Could not change this record status.')}
  }

  async function restore(item:any){
    const restoreStatus='ACTIVE'
    try{
      await apiFetch('/'+endpoint+'/'+item.id,{method:'PATCH',body:JSON.stringify({status:restoreStatus})})
      setMessage(displayName(item)+' restored to ACTIVE.')
      await loadReferenceData();await loadSection(page)
    }catch(e){setError(e instanceof Error?e.message:'Could not restore this record.')}
  }

  async function removeRelationship(item:Relationship){
    if(!window.confirm('Remove this topic relationship? This changes planner knowledge, but does not delete either topic.'))return
    try{
      await apiFetch('/topic-relationships/'+item.id,{method:'DELETE'})
      setMessage('Topic relationship removed.')
      await loadSection(page)
    }catch(e){setError(e instanceof Error?e.message:'Could not remove the relationship.')}
  }

  function displayName(item:any){
    if(section==='relationships')return topicName(item.source_topic_id)+' → '+topicName(item.target_topic_id)
    return item.name||item.code||('Record #'+item.id)
  }
  function topicName(id:number){const t=topics.find(x=>x.id===id);return t?t.name:'Topic #'+id}
  function streamName(id:number){const s=streams.find(x=>x.id===id);return s?s.code+' · '+s.name:'Stream #'+id}
  function courseName(id:number){const c=courses.find(x=>x.id===id);return c?c.code+' · '+c.name:'Course #'+id}
  function chapterName(id:number){const c=chapters.find(x=>x.id===id);return c?c.order_index+'. '+c.name:'Chapter #'+id}

  const field=(key:string,label:string,type='text',placeholder='')=><label key={key}><span>{label}</span><input type={type} value={form[key]||''} onChange={e=>setValue(key,e.target.value)} placeholder={placeholder}/></label>
  const selectField=(key:string,label:string,options:{value:string;label:string}[],placeholder?:string,onChange?:(value:string)=>void)=><label key={key}><span>{label}</span><select value={form[key]||''} onChange={e=>{setValue(key,e.target.value);onChange?.(e.target.value)}}><option value=''>{placeholder||'Select…'}</option>{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>

  function formContent(){
    if(section==='universities')return <>{field('name','Name','text','Addis Ababa University')}{field('code','Code','text','AAU')}{field('description','Description')}{selectField('status','Status',statusOptions.universities.map(x=>({value:x,label:x})),'Select status')}</>
    if(section==='curricula')return <>{selectField('university_id','University',universities.map(x=>({value:String(x.id),label:x.code+' · '+x.name})),undefined,setUniversityId)}{field('name','Name','text','Freshman Curriculum')}{field('version','Version','text','2025.1')}{field('academic_year','Academic year','text','2025/26')}{field('description','Description')}{selectField('status','Status',statusOptions.curricula.map(x=>({value:x,label:x})))}</>
    if(section==='streams')return <>{selectField('curriculum_id','Curriculum',curricula.map(x=>({value:String(x.id),label:x.name+' · v'+x.version})),undefined,setCurriculumId)}{field('name','Name','text','Natural Science')}{field('code','Code','text','NATURAL')}{field('description','Description')}{selectField('status','Status',statusOptions.streams.map(x=>({value:x,label:x})))}</>
    if(section==='courses')return <>{selectField('stream_id','Stream',streams.map(x=>({value:String(x.id),label:x.code+' · '+x.name})),undefined,setStreamId)}{field('code','Code','text','PHY101')}{field('name','Name','text','Physics')}{field('credit_hours','Credit hours','number','3')}{field('description','Description')}{selectField('status','Status',statusOptions.courses.map(x=>({value:x,label:x})))}</>
    if(section==='chapters')return <>{selectField('course_id','Course',courses.map(x=>({value:String(x.id),label:x.code+' · '+x.name})),undefined,setCourseId)}{field('name','Name','text','Measurement')}{field('order_index','Order','number','1')}{field('description','Description')}{selectField('status','Status',statusOptions.chapters.map(x=>({value:x,label:x})))}</>
    if(section==='topics')return <>{selectField('chapter_id','Chapter',chapters.map(x=>({value:String(x.id),label:chapterName(x.id)})),undefined,setChapterId)}{field('name','Name','text','Physical quantities')}{field('order_index','Order','number','1')}{field('difficulty','Difficulty 1–5','number','3')}{field('estimated_study_minutes','Study minutes','number','60')}{field('exam_importance','Exam importance 0–1','number','0.5')}{field('conceptual_importance','Conceptual importance 0–1','number','0.5')}{field('description','Description')}{selectField('status','Status',statusOptions.topics.map(x=>({value:x,label:x})))}</>
    if(section==='mappings')return <>{selectField('stream_id','Stream',streams.map(x=>({value:String(x.id),label:streamName(x.id)})),undefined,setStreamId)}{selectField('course_id','Course',courses.map(x=>({value:String(x.id),label:courseName(x.id)})),undefined,setCourseId)}{selectField('semester_number','Semester',[{value:'1',label:'Semester 1'},{value:'2',label:'Semester 2'}])}{field('order_index','Order','number','1')}{selectField('status','Status',statusOptions.mappings.map(x=>({value:x,label:x})))}</>
    return <>{selectField('source_topic_id','Source topic',topics.map(x=>({value:String(x.id),label:topicName(x.id)})))}{selectField('target_topic_id','Target topic',topics.map(x=>({value:String(x.id),label:topicName(x.id)})))}{selectField('relationship_type','Relationship type',['prerequisite','conceptual','cross_course','related','revision'].map(x=>({value:x,label:x})))}{field('strength','Strength 0–1','number','1')}{field('notes','Notes') }</>
  }

  function listItem(item:any){
    if(section==='relationships')return <article className='managementItem' key={item.id}><div><b>{item.relationship_type}</b><h3>{topicName(item.source_topic_id)} → {topicName(item.target_topic_id)}</h3><small>Strength {item.strength} · {item.status||'ACTIVE'}</small></div><div className='managementItemActions'><button onClick={()=>beginEdit(item)}>Edit</button><button className='danger' onClick={()=>removeRelationship(item)}>Remove</button></div></article>
    const inactive=item.status!=='ACTIVE'
    return <article className='managementItem' key={item.id}><div><b>{item.code||('ID '+item.id)}</b><h3>{item.name}</h3><small>{section==='curricula'?'v'+item.version+' · ':''}{item.status}</small></div><div className='managementItemActions'><button onClick={()=>beginEdit(item)}>Edit</button>{inactive?<button onClick={()=>restore(item)}>Restore</button>:<button className='danger' onClick={()=>archive(item)}>Deactivate</button>}</div></article>
  }

  const selectedParent=section==='curricula'?universities.find(x=>String(x.id)===universityId):
    section==='streams'?curricula.find(x=>String(x.id)===curriculumId):
    section==='courses'?streams.find(x=>String(x.id)===streamId):
    section==='chapters'?courses.find(x=>String(x.id)===courseId):
    section==='topics'?chapters.find(x=>String(x.id)===chapterId):null

  return <div className='managementPage'>
    <header className='workspaceHeader'>
      <span>HAVAN ADMIN MANAGEMENT</span>
      <h1>One control center for academic data</h1>
      <p>Management is the source of truth for Havan’s academic hierarchy, course placement, and topic relationships. Imports remain for bulk loading only.</p>
    </header>

    {message&&<div className='notice workspaceNotice'>{message}</div>}
    {error&&<div className='alert workspaceNotice'>{error}<button onClick={()=>setError('')}>×</button></div>}

    <nav className='managementTabs' aria-label='Academic data sections'>
      {(Object.keys(labels) as Section[]).map(key=><button key={key} className={section===key?'active':''} onClick={()=>setSection(key)}>{labels[key]}</button>)}
    </nav>

    {section==='mappings'?<UniversityCourseMappingWorkspace/>:<>
    <div className='hierarchyBar'>
      <span>Current scope</span>
      <b>{selectedParent?('› '+(selectedParent as any).name):section==='universities'?'All universities':section==='relationships'?'All topic relationships':'Choose a parent to narrow this level'}</b>
      {section!=='universities'&&section!=='relationships'&&<button onClick={()=>{setUniversityId('');setCurriculumId('');setStreamId('');setCourseId('');setChapterId('')}}>Clear scope</button>}
    </div>

    <section className='managementToolbar'>
      {section==='curricula'&&<select value={universityId} onChange={e=>setUniversityId(e.target.value)}><option value=''>All universities</option>{universities.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select>}
      {section==='streams'&&<select value={curriculumId} onChange={e=>setCurriculumId(e.target.value)}><option value=''>All curricula</option>{curricula.map(x=><option key={x.id} value={x.id}>{x.name} · v{x.version}</option>)}</select>}
      {section==='courses'&&<select value={streamId} onChange={e=>setStreamId(e.target.value)}><option value=''>All streams</option>{streams.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select>}
      {section==='chapters'&&<select value={courseId} onChange={e=>setCourseId(e.target.value)}><option value=''>All courses</option>{courses.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select>}
      {section==='topics'&&<select value={chapterId} onChange={e=>setChapterId(e.target.value)}><option value=''>All chapters</option>{chapters.map(x=><option key={x.id} value={x.id}>{chapterName(x.id)}</option>)}</select>}
      {(section==='universities'||section==='relationships')&&<div className='toolbarSpacer'/>}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={'Search '+labels[section].toLowerCase()+' on this page…'}/>
      <button onClick={clearForm}>New</button>
    </section>

    <section className='managementGrid'>
      <div className='managementCard'>
        <div className='managementCardHead'><div><span>{editing?'EDIT RECORD':'NEW RECORD'}</span><h2>{editing?'Edit '+labels[section].slice(0,-1):'Add '+labels[section].slice(0,-1)}</h2></div></div>
        {formContent()}
        <div className='managementActions'><button onClick={clearForm}>Clear</button><button className='workspacePrimary' disabled={saving} onClick={save}>{saving?'Saving…':editing?'Save changes':'Create'}</button></div>
        {masterSections.includes(section)&&<small className='managementHint'>Parent selection is explicit. Deactivation is safe: records stay in the database and can be restored.</small>}
        {section==='relationships'&&<small className='managementHint'>Relationships are planner knowledge. Removing one never deletes either topic.</small>}
      </div>

      <div className='managementCard managementListCard'>
        <div className='managementCardHead'><div><span>{labels[section].toUpperCase()}</span><h2>{total} record{total===1?'':'s'}</h2></div><small>Page {pages?Math.min(page,pages):0} of {pages||0}</small></div>
        {loading?<div className='empty'>Loading…</div>:filtered.length===0?<div className='empty'><h3>No records on this page</h3><p>Create a record or change the scope.</p></div>:<div className='managementList'>{filtered.map(listItem)}</div>}
        {pages>1&&<div className='pagination'><button disabled={page<=1||loading} onClick={()=>loadSection(page-1)}>Previous</button><span>Page {page} / {pages}</span><button disabled={page>=pages||loading} onClick={()=>loadSection(page+1)}>Next</button></div>}
      </div>
    </section>
    </>}
  </div>
}
