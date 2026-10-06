'use client'
import {useEffect,useState} from 'react'
import {apiFetch} from '@/lib/api'
import CrudList,{entityConfigs,EntityKey} from './CrudList'
import styles from './admin.module.css'
type Item={id:number;name:string;code?:string}
export default function ContentScreen(){const [entity,setEntity]=useState<EntityKey>('courses'),[courseId,setCourseId]=useState(''),[chapterId,setChapterId]=useState(''),[courses,setCourses]=useState<Item[]>([]),[chapters,setChapters]=useState<Item[]>([])
 useEffect(()=>{apiFetch<{items:Item[]}>('/courses?page=1&page_size=100').then(x=>setCourses(x.items)).catch(()=>setCourses([]))},[])
 useEffect(()=>{if(courseId)apiFetch<{items:Item[]}>('/chapters?course_id='+courseId+'&page=1&page_size=100').then(x=>setChapters(x.items));else setChapters([])},[courseId])
 const config=entityConfigs.find(x=>x.key===entity)!
 return <section><header className={styles.header}><span>CONTENT</span><h1>Courses, chapters & topics</h1><p>Edit the reusable catalog from one focused workspace.</p></header><div className={styles.tabs}>{entityConfigs.map(x=><button className={entity===x.key?styles.active:''} key={x.key} onClick={()=>setEntity(x.key)}>{x.label}</button>)}</div>{entity==='chapters'&&<label className={styles.scope}>Course<select value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="">Choose a course</option>{courses.map(x=><option key={x.id} value={x.id}>{x.code||''} · {x.name}</option>)}</select></label>}{entity==='topics'&&<label className={styles.scope}>Chapter<select value={chapterId} onChange={e=>setChapterId(e.target.value)}><option value="">Choose a chapter</option>{chapters.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}<CrudList config={config} parentId={entity==='chapters'?courseId:entity==='topics'?chapterId:undefined}/></section>}
