'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type Promotion = { id:number; platform_name:string; description?:string|null; button_text:string; url:string; order_index:number; status:string }

export default function PromotionManager({ parentType, parentId }:{parentType:'chapter'|'topic'; parentId:string}) {
  const [items,setItems]=useState<Promotion[]>([])
  const [form,setForm]=useState({platform_name:'',description:'',button_text:'Open platform',url:''})
  const [error,setError]=useState('')

  function load(){ if(!parentId){setItems([]);return}; const key=parentType==='chapter'?'chapter_id':'topic_id'; apiFetch<{items:Promotion[]}>('/promotions?'+key+'='+parentId+'&page=1&page_size=50').then(r=>setItems(r.items)).catch(e=>setError(e instanceof Error?e.message:'Could not load promotions.')) }
  useEffect(load,[parentType,parentId])

  async function save(){
    if(!form.platform_name.trim()||!form.url.trim()) return
    setError('')
    try { const body={...(parentType==='chapter'?{chapter_id:Number(parentId)}:{topic_id:Number(parentId)}),...form,platform_name:form.platform_name.trim(),description:form.description.trim()||null,url:form.url.trim()}; const result=await apiFetch<Promotion>('/promotions',{method:'POST',body:JSON.stringify(body)}); setItems(old=>[...old,result]); setForm({platform_name:'',description:'',button_text:'Open platform',url:''}) }
    catch(e){setError(e instanceof Error?e.message:'Could not save promotion.')}
  }
  async function deactivate(id:number){ if(!window.confirm('Deactivate this promotion?')) return; await apiFetch('/promotions/'+id,{method:'PATCH',body:JSON.stringify({status:'INACTIVE'})}); load() }
  return <div className={styles.promotionCard}><div className={styles.crudHead}><div><span>LEARN MORE WITH HAVAN</span><h2>{parentType==='chapter'?'Chapter promotions':'Topic-specific promotions'}</h2><p>{parentType==='chapter'?'These links appear for every topic in this chapter.':'Use this for an additional destination for one topic.'}</p></div></div>{error&&<div className={styles.alert}>{error}</div>}{items.filter(x=>x.status==='ACTIVE').map(x=><div className={styles.promotionRow} key={x.id}><div><b>{x.platform_name}</b><span>{x.description||'No description'}</span></div><button className={styles.danger} onClick={()=>void deactivate(x.id)}>Deactivate</button></div>)}<div className={styles.promotionForm}><label>Platform name<input value={form.platform_name} onChange={e=>setForm({...form,platform_name:e.target.value})} placeholder='Havan Academy'/></label><label>Description<input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>Button text<input value={form.button_text} onChange={e=>setForm({...form,button_text:e.target.value})}/></label><label>URL<input value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder='https://...'/></label><button className={styles.primary} disabled={!form.platform_name.trim()||!form.url.trim()} onClick={()=>void save()}>Add promotion</button></div></div>
}