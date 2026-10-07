'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, ApiError } from '@/lib/api'
import { Button, Card, Chip, DateField, ErrorState, ProgressBar, Select, Skeleton } from '@/components/ui'

type Exam = { id:number; student_id:number; course_id:number; exam_type:string; exam_date:string; importance:number; selected_topic_ids:number[] }
type Course = { id:number; code:string; name:string; chapters:Array<{id:number;name:string;topics:Array<{id:number;name:string;estimated_study_minutes:number;difficulty:number;status:string}>}> }
type Profile = { id:number; study_hours_per_day:number; study_days:string[] }
type Progress = { topic_id:number; status:string; completed_minutes:number; confidence:number }
type ExamInsight = { exam:Exam; course?:Course; daysLeft:number; topicCount:number; completedTopics:number; remainingMinutes:number; availableMinutes:number; coverage:number; pressure:number; label:'READY'|'ON TRACK'|'TIGHT'|'URGENT'|'PAST'; scopeExplicit:boolean; strategy:string; priorityTopics:string[] }

const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat']

function todayKey(){ const now=new Date(); return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0') }
function daysUntil(date:string){
  const target = new Date(date + 'T00:00:00')
  const today = new Date(todayKey() + 'T00:00:00')
  return Math.ceil((target.getTime()-today.getTime())/86400000)
}
function availableStudyMinutes(profile:Profile,daysLeft:number){
  if(daysLeft<=0)return 0
  const allowed=new Set(profile.study_days); let total=0; const cursor=new Date()
  for(let i=0;i<daysLeft;i+=1){ if(allowed.has(DAY_KEYS[cursor.getDay()])) total+=Math.round(profile.study_hours_per_day*60); cursor.setDate(cursor.getDate()+1) }
  return total
}
function examLabel(daysLeft:number,coverage:number,pressure:number):ExamInsight['label']{
  if(daysLeft<0)return 'PAST'
  if(coverage>=85&&pressure<=.9)return 'READY'
  if(daysLeft<=3||pressure>1.2)return 'URGENT'
  if(pressure>.85)return 'TIGHT'
  return 'ON TRACK'
}

export default function ExamPlanner(){
  const [profile,setProfile]=useState<Profile|null>(null)
  const [courses,setCourses]=useState<Course[]>([])
  const [progress,setProgress]=useState<Progress[]>([])
  const [exams,setExams]=useState<Exam[]>([])
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('')
  const [courseId,setCourseId]=useState(''),[examType,setExamType]=useState('Final'),[examDate,setExamDate]=useState(''),[importance,setImportance]=useState('3')
  const [editingId,setEditingId]=useState<number|null>(null)\n  const [selectedTopicIds,setSelectedTopicIds]=useState<number[]>([])

  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try{
      const [profileData,catalog,progressData,examsData]=await Promise.all([
        apiFetch<Profile>('/students/me/profile'),apiFetch<Course[]>('/students/me/catalog'),
        apiFetch<Progress[]>('/students/me/progress'),apiFetch<Exam[]>('/students/me/exams')
      ])
      setProfile(profileData);setCourses(catalog);setProgress(progressData);setExams(examsData)
      if(!courseId&&catalog[0])setCourseId(String(catalog[0].id))
    }catch(err){setError(err instanceof ApiError?err.message:'Could not load your exam workspace.')}
    finally{setLoading(false)}
  },[courseId])

  useEffect(()=>{void load()},[load])
  const progressMap=useMemo(()=>new Map(progress.map(item=>[item.topic_id,item])),[progress])
  const insights=useMemo<ExamInsight[]>(()=>{
    if(!profile)return []
    return exams.map(exam=>{
      const course=courses.find(item=>item.id===exam.course_id)
      const allTopics=course?.chapters.flatMap(ch=>ch.topics.filter(topic=>topic.status.toUpperCase()==='ACTIVE'))??[]\n      const scopedIds=new Set(exam.selected_topic_ids??[])\n      const scopeExplicit=scopedIds.size>0\n      const topics=scopeExplicit?allTopics.filter(topic=>scopedIds.has(topic.id)):allTopics
      const completedTopics=topics.filter(topic=>progressMap.get(topic.id)?.status==='COMPLETED').length
      const workload=topics.map(topic=>{
        const item=progressMap.get(topic.id)
        const remaining=Math.max(0,topic.estimated_study_minutes-(item?.completed_minutes??0))
        const difficultyWeight=1+((topic.difficulty-3)*0.12)
        const confidenceWeight=1+((5-(item?.confidence??3))*0.08)
        return {topic,remaining,priority:remaining*difficultyWeight*confidenceWeight}
      })
      const remainingMinutes=Math.round(workload.reduce((sum,item)=>sum+item.remaining,0))
      const weightedRemainingMinutes=Math.round(workload.reduce((sum,item)=>sum+item.priority,0))
      const priorityTopics=workload.filter(item=>item.remaining>0).sort((a,b)=>b.priority-a.priority).slice(0,3).map(item=>item.topic.name)
      const daysLeft=daysUntil(exam.exam_date),availableMinutes=availableStudyMinutes(profile,daysLeft)
      const coverage=topics.length?(completedTopics/topics.length)*100:0
      const importanceWeight=0.75+(exam.importance*0.1)
      const pressure=availableMinutes?(weightedRemainingMinutes/availableMinutes)*importanceWeight:weightedRemainingMinutes?9:0
      const strategy=remainingMinutes===0?'Maintain light revision and practice to protect readiness.':pressure>1.2?'Prioritise the highest-pressure topics, especially difficult or low-confidence work, then protect the final study days for revision and practice.':pressure>.85?'Split the remaining scope across consistent sessions, starting with the highest-pressure topics, and protect a final revision window.':'Build steady topic coverage first, then use the remaining capacity for practice and recall.'
      return {exam,course,daysLeft,topicCount:topics.length,completedTopics,remainingMinutes,availableMinutes,coverage,pressure,label:examLabel(daysLeft,coverage,pressure),scopeExplicit,strategy}
    }).sort((a,b)=>a.daysLeft-b.daysLeft)
  },[courses,exams,profile,progressMap])

  const nextExam=insights.find(item=>item.daysLeft>=0)??insights[0]
  const activeCount=insights.filter(item=>item.daysLeft>=0).length

  async function saveExam(){
    if(!profile||!courseId||!examDate||!examType.trim())return
    setSaving(true);setError('')
    try{
      const payload={course_id:Number(courseId),exam_type:examType.trim(),exam_date:examDate,importance:Number(importance),selected_topic_ids:selectedTopicIds}
      const path=editingId?'/students/profiles/'+profile.id+'/exams/'+editingId:'/students/profiles/'+profile.id+'/exams'
      const saved=await apiFetch<Exam>(path,{method:editingId?'PATCH':'POST',body:JSON.stringify(payload)})
      setExams(current=>editingId?current.map(item=>item.id===saved.id?saved:item):[...current,saved])
      setEditingId(null);setExamType('Final');setExamDate('');setImportance('3');setSelectedTopicIds([])
    }catch(err){setError(err instanceof ApiError?err.message:'Could not save this exam.')}
    finally{setSaving(false)}
  }

  async function removeExam(id:number){
    if(!profile)return
    try{
      await apiFetch<void>('/students/profiles/'+profile.id+'/exams/'+id,{method:'DELETE'})
      setExams(current=>current.filter(item=>item.id!==id));if(editingId===id)setEditingId(null)
    }catch(err){setError(err instanceof ApiError?err.message:'Could not remove this exam.')}
  }

  function editExam(item:Exam){
    setEditingId(item.id);setCourseId(String(item.course_id));setExamType(item.exam_type);setExamDate(item.exam_date);setImportance(String(item.importance));setSelectedTopicIds(item.selected_topic_ids??[])
    window.scrollTo({top:0,behavior:'smooth'})
  }

  if(loading)return <div className="exam-planner-loading"><Skeleton height={170}/><Skeleton height={260}/><Skeleton height={220}/></div>
  if(error&&!profile)return <ErrorState onRetry={()=>void load()} message={error}/>

  return <div className="exam-planner">
    <section className="exam-hero">
      <div className="exam-hero-glow" aria-hidden="true"/>
      <div><span className="exam-eyebrow">HAVAN EXAM PLANNING</span><h2>Prepare for the exam in front of you.</h2><p>Exam Planning watches the runway to each exam and turns your real course progress and available study time into clear preparation signals.</p></div>
      <div className="exam-hero-stats"><div><strong>{activeCount}</strong><span>upcoming exams</span></div><div><strong>{nextExam?Math.max(0,nextExam.daysLeft):'—'}</strong><span>days to next exam</span></div></div>
    </section>

    {error&&<div className="exam-error" role="alert">{error}</div>}

    <Card className="exam-editor" padding="lg">
      <div className="exam-section-heading"><div><span className="exam-kicker">{editingId?'UPDATE EXAM':'ADD EXAM'}</span><h2>{editingId?'Keep the exam runway accurate.':'Tell Havan what you are preparing for.'}</h2></div><span className="exam-source-note">Your exam date stays under your control.</span></div>
      <div className="exam-form-grid">
        <Select label="Course" value={courseId} onChange={setCourseId} options={courses.map(course=>({value:String(course.id),label:course.code+' · '+course.name}))}/>
        <label className="field">Exam type<input value={examType} onChange={event=>setExamType(event.target.value)} placeholder="Final, Midterm, Quiz..."/></label>
        <DateField label="Exam date" value={examDate} min={todayKey()} onChange={setExamDate}/>
        <Select label="Importance" value={importance} onChange={setImportance} options={[1,2,3,4,5].map(value=>({value:String(value),label:value===5?'5 · Critical':value===1?'1 · Low':String(value)+' · '+(value>=4?'High':'Normal')}))}/>
      </div>
      <div className="exam-scope">
        <div><span className="exam-kicker">EXAM SCOPE</span><h3>What exactly are you preparing?</h3><p>Select specific topics when this exam covers only part of the course. Leave everything unselected to use the full active course scope.</p></div>
        <div className="exam-scope-actions"><Button variant="ghost" onClick={()=>setSelectedTopicIds([])}>Use full course</Button><span>{selectedTopicIds.length ? selectedTopicIds.length+' topics selected' : 'Full active course selected'}</span></div>
        <div className="exam-topic-groups">{(courses.find(course=>String(course.id)===courseId)?.chapters??[]).map(chapter=><div key={chapter.id} className="exam-topic-group">
          <strong>{chapter.name}</strong>
          <div>{chapter.topics.filter(topic=>topic.status.toUpperCase()==='ACTIVE').map(topic=><label key={topic.id} className="exam-topic-option"><input type="checkbox" checked={selectedTopicIds.includes(topic.id)} onChange={event=>setSelectedTopicIds(current=>event.target.checked?[...current,topic.id]:current.filter(id=>id!==topic.id))}/><span>{topic.name}</span><small>{topic.estimated_study_minutes} min</small></label>)}</div>
        </div>)}</div>
      </div>
      <div className="exam-editor-actions"><Button variant="accent" size="lg" disabled={!courseId||!examDate||!examType.trim()} loading={saving} onClick={()=>void saveExam()}>{editingId?'Update exam':'Add exam'}</Button>{editingId&&<Button variant="ghost" onClick={()=>{setEditingId(null);setExamDate('');setExamType('Final');setImportance('3');setSelectedTopicIds([])}}>Cancel</Button>}</div>
    </Card>

    <section className="exam-section">
      <div className="exam-section-heading"><div><span className="exam-kicker">EXAM RUNWAY</span><h2>What needs attention?</h2></div><span className="exam-source-note">Calculated from curriculum + progress + study capacity</span></div>
      {insights.length===0?<Card className="exam-empty" padding="lg"><strong>No exam is on the runway yet.</strong><p>Add an exam above. Havan will then calculate time pressure and topic coverage from your actual course data.</p></Card>:
      <div className="exam-insight-grid">{insights.map(item=><Card key={item.exam.id} className="exam-insight-card" padding="lg">
        <div className="exam-card-top"><div><span className="exam-kicker">{item.exam.exam_type.toUpperCase()}</span><h3>{item.course?.code??'Course'} · {item.course?.name??'Unavailable course'}</h3></div><Chip tone={item.label==='READY'?'success':item.label==='URGENT'||item.label==='PAST'?'danger':item.label==='TIGHT'?'warn':'info'}>{item.label}</Chip></div>
        <div className="exam-countdown"><strong>{item.daysLeft<0?Math.abs(item.daysLeft):item.daysLeft}</strong><span>{item.daysLeft<0?'days ago':'days left'}</span></div>
        <ProgressBar value={item.coverage} label="Topic coverage"/>
        <div className="exam-metrics"><span><b>{item.completedTopics}/{item.topicCount}</b> topics covered</span><span><b>{Math.ceil(item.remainingMinutes/60)}h</b> estimated work left</span><span><b>{Math.round(item.availableMinutes/60)}h</b> study capacity before exam</span></div>
        <p className="exam-scope-status">{item.scopeExplicit ? `Scope: ${item.topicCount} selected topics` : `Scope: full active course (${item.topicCount} topics)`}</p><p className="exam-explanation">{item.label==='READY'?'Your current coverage and available capacity leave a healthy preparation margin.':item.label==='URGENT'?'The remaining work is pressing against the time available. Prioritise revision and practice now.':item.label==='TIGHT'?'The runway is getting narrow. Consistent study sessions will matter more than last-minute cramming.':item.label==='PAST'?'This exam date has passed. Keep the record for history, or update it if the date changed.':'Your current preparation pace has room. Keep studying consistently and monitor coverage.'}</p>
        <div className="exam-strategy"><strong>Preparation strategy</strong><span>{item.strategy}</span>{item.priorityTopics.length>0&&<small>Priority: {item.priorityTopics.join(" · ")}</small>}</div><div className="exam-card-actions"><Button variant="secondary" onClick={()=>editExam(item.exam)}>Edit</Button><Button variant="ghost" onClick={()=>void removeExam(item.exam.id)}>Remove</Button></div>
      </Card>)}</div>}
    </section>

    <Card className="exam-intelligence" padding="lg">
      <div><span className="exam-kicker">HAVAN INTELLIGENCE</span><h2>Exam Planning stays separate for a reason.</h2><p>Havan Study Planning answers “what do I want to study and when?” Exam Planning answers “how ready am I for this specific exam, and where is the pressure?”</p></div>
      <div className="exam-intelligence-list"><div><strong>1</strong><span>Exam date creates the runway.</span></div><div><strong>2</strong><span>Curriculum topics define the workload.</span></div><div><strong>3</strong><span>Your progress defines actual coverage.</span></div><div><strong>4</strong><span>Your study capacity reveals time pressure.</span></div></div>
    </Card>
  </div>
}
