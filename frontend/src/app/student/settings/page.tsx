'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../../lib/api'
import { clearAuth, getAuthToken, getSavedAccount, type AuthAccount } from '../../../lib/auth'
import '../student.css'

type Item = Record<string, any>
type Collection = { items: Item[]; total: number }
const apiList = async (path: string) => (await apiFetch<Collection>(path)).items

function HavanSelect({ value, options, placeholder, disabled, onChange }: { value: string; options: {value:string;label:string}[]; placeholder:string; disabled?:boolean; onChange:(value:string)=>void }) {
  const [open,setOpen]=useState(false)
  const selected=options.find(x=>x.value===value)
  return <div className="havan-select settings-select">
    <button type="button" className="havan-select-trigger" disabled={disabled} aria-expanded={open} onClick={()=>setOpen(x=>!x)}><span className={selected?'has-value':''}>{selected?.label ?? placeholder}</span><i>{open?'−':'+'}</i></button>
    {open&&!disabled&&<div className="havan-select-menu" role="listbox">{options.length?options.map(x=><button type="button" className={x.value===value?'havan-select-option selected':'havan-select-option'} key={x.value} onClick={()=>{onChange(x.value);setOpen(false)}}><span>{x.label}</span>{x.value===value&&<b>✓</b>}</button>):<div className="havan-select-empty">No options available</div>}</div>}
  </div>
}

export default function StudentSettings() {
  const router=useRouter()
  const [account,setAccount]=useState(getSavedAccount())
  const [profile,setProfile]=useState<Item|null>(null)
  const [universities,setUniversities]=useState<Item[]>([])
  const [curriculums,setCurriculums]=useState<Item[]>([])
  const [streams,setStreams]=useState<Item[]>([])
  const [form,setForm]=useState({name:'',universityId:'',curriculumId:'',streamId:'',studyHours:2,studyDays:[1,2,3,4,5]})
  const [passwords,setPasswords]=useState({current:'',next:'',confirm:''})
  const [saving,setSaving]=useState(false)
  const [passwordSaving,setPasswordSaving]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  useEffect(()=>{(async()=>{
    if(!getAuthToken()){router.replace('/auth');return}
    try{
      const me=await apiFetch<AuthAccount>('/auth/me'); setAccount(me)
      if(!me.student_profile_id){router.replace('/student');return}
      const p=await apiFetch<Item>('/students/profiles/'+me.student_profile_id)
      setProfile(p); setForm({name:p.name,universityId:String(p.university_id),curriculumId:String(p.curriculum_id),streamId:String(p.stream_id),studyHours:p.study_hours_per_day,studyDays:p.study_days})
      setUniversities(await apiList('/universities?page=1&page_size=100'))
    }catch(err){setError(err instanceof Error?err.message:'Could not load your account.')}
  })()},[router])

  useEffect(()=>{if(form.universityId)apiList('/curriculums?university_id='+form.universityId+'&page=1&page_size=100').then(setCurriculums).catch(()=>setCurriculums([]));else setCurriculums([])},[form.universityId])
  useEffect(()=>{if(form.curriculumId)apiList('/streams?curriculum_id='+form.curriculumId+'&page=1&page_size=100').then(setStreams).catch(()=>setStreams([]));else setStreams([])},[form.curriculumId])

  async function save(){
    if(!profile||!account)return
    setSaving(true);setError('');setMessage('')
    try{
      const updated=await apiFetch<Item>('/students/profiles/'+profile.id,{method:'PATCH',body:JSON.stringify({name:form.name,university_id:Number(form.universityId),curriculum_id:Number(form.curriculumId),stream_id:Number(form.streamId),study_hours_per_day:form.studyHours,study_days:form.studyDays})})
      setProfile(updated);setMessage('Profile updated successfully.')
    }catch(err){setError(err instanceof Error?err.message:'Could not save your profile.')}finally{setSaving(false)}
  }
  async function changePassword(){
    setError('');setMessage('')
    if(passwords.next!==passwords.confirm){setError('New passwords do not match.');return}
    setPasswordSaving(true)
    try{await apiFetch('/auth/change-password',{method:'POST',body:JSON.stringify({current_password:passwords.current,new_password:passwords.next})});setPasswords({current:'',next:'',confirm:''});setMessage('Password changed successfully.')}catch(err){setError(err instanceof Error?err.message:'Could not change your password.')}finally{setPasswordSaving(false)}
  }

  return <main className="student-shell"><div className="dashboard-shell">
    <header className="student-topbar"><a className="student-brand" href="/student"><span className="student-mark">H</span><strong>Havan</strong><span>Study Planner</span></a><nav className="student-nav"><button type="button" className="student-secondary" onClick={()=>router.push('/student')}>Back to dashboard</button><button type="button" className="student-logout-button" onClick={()=>{clearAuth();router.replace('/auth')}}>Sign out</button></nav></header>
    <section className="settings-hero"><span className="student-eyebrow">ACCOUNT & PROFILE</span><h1>Keep your study identity current.</h1><p>Update the information Havan uses to understand your academic context and available study capacity.</p></section>
    {error&&<div className="student-error">{error}</div>}{message&&<div className="settings-success">{message}</div>}
    <div className="settings-grid">
      <section className="panel settings-card"><div className="panel-heading"><div><span className="student-eyebrow">ACADEMIC PROFILE</span><h2>Profile information</h2></div></div>
        <div className="settings-id"><span>Profile ID</span><b>#{profile?.id ?? '—'}</b><span>Account</span><b>{account?.email ?? '—'}</b></div>
        <label className="settings-label">Full name<input className="settings-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label className="settings-label">University<HavanSelect value={form.universityId} placeholder="Select university" options={universities.map(x=>({value:String(x.id),label:x.name}))} onChange={v=>setForm({...form,universityId:v,curriculumId:'',streamId:''})}/></label>
        <label className="settings-label">Curriculum<HavanSelect value={form.curriculumId} placeholder="Select curriculum" disabled={!form.universityId} options={curriculums.map(x=>({value:String(x.id),label:x.name+' · v'+x.version}))} onChange={v=>setForm({...form,curriculumId:v,streamId:''})}/></label>
        <label className="settings-label">Stream<HavanSelect value={form.streamId} placeholder="Select stream" disabled={!form.curriculumId} options={streams.map(x=>({value:String(x.id),label:x.name}))} onChange={v=>setForm({...form,streamId:v})}/></label>
        <label className="settings-label">Study hours per day<input className="settings-input" type="number" min="0.5" max="12" step="0.5" value={form.studyHours} onChange={e=>setForm({...form,studyHours:Number(e.target.value)})}/></label>
        <span className="settings-label">Study days</span><div className="day-pick">{[{id:0,s:'Sun'},{id:1,s:'Mon'},{id:2,s:'Tue'},{id:3,s:'Wed'},{id:4,s:'Thu'},{id:5,s:'Fri'},{id:6,s:'Sat'}].map(d=><button type="button" key={d.id} className={form.studyDays.includes(d.id)?'day selected':'day'} onClick={()=>setForm({...form,studyDays:form.studyDays.includes(d.id)?form.studyDays.filter(x=>x!==d.id):[...form.studyDays,d.id]})}>{d.s}</button>)}</div>
        <button type="button" className="student-primary settings-save" disabled={saving||form.studyDays.length===0} onClick={save}>{saving?'Saving…':'Save profile changes'}</button>
      </section>
      <section className="panel settings-card"><div className="panel-heading"><div><span className="student-eyebrow">SECURITY</span><h2>Account security</h2></div></div>
        <div className="security-note"><b>{account?.email}</b><span>Your account keeps your Havan profile connected when you return.</span></div>
        <label className="settings-label">Current password<input className="settings-input" type="password" value={passwords.current} onChange={e=>setPasswords({...passwords,current:e.target.value})}/></label>
        <label className="settings-label">New password<input className="settings-input" type="password" minLength={8} value={passwords.next} onChange={e=>setPasswords({...passwords,next:e.target.value})}/></label>
        <label className="settings-label">Confirm new password<input className="settings-input" type="password" minLength={8} value={passwords.confirm} onChange={e=>setPasswords({...passwords,confirm:e.target.value})}/></label>
        <button type="button" className="student-secondary settings-save" disabled={passwordSaving||!passwords.current||!passwords.next||!passwords.confirm} onClick={changePassword}>{passwordSaving?'Updating…':'Change password'}</button>
        <div className="settings-danger"><b>Sign out</b><span>End this browser session. Your profile and study data remain saved.</span><button type="button" onClick={()=>{clearAuth();router.replace('/auth')}}>Sign out of Havan</button></div>
      </section>
    </div>
  </div></main>
}
