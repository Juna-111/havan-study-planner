'use client'

import {useEffect,useState} from 'react'
import './admin.css'
import FreshmanRegistryWorkspace from './FreshmanRegistryWorkspace'
import AcademicQuality from './AcademicQuality'
import AdminManagementWorkspace from './AdminManagementWorkspace'
import TopicRelationshipAIWorkspace from './TopicRelationshipAIWorkspace'

type Mode='management'|'freshman'|'quality'|'relationships'

const navigation:Array<{mode:Mode;label:string;icon:string}>=
  [
    {mode:'management',label:'Management',icon:'⚙'},
    {mode:'freshman',label:'Course registry',icon:'▣'},
    {mode:'quality',label:'Academic quality',icon:'✓'},
    {mode:'relationships',label:'Topic relationships',icon:'↔'}
  ]

export default function Admin(){
  const [mode,setMode]=useState<Mode>('management')
  const [mobileNav,setMobileNav]=useState(false)

  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get('mode') as Mode|null
    if(requested&&navigation.some(item=>item.mode===requested))setMode(requested)
  },[])

  const selectMode=(next:Mode)=>{
    setMode(next)
    setMobileNav(false)
  }

  const workspace={
    management:<AdminManagementWorkspace/>,
    freshman:<FreshmanRegistryWorkspace/>,
    quality:<AcademicQuality/>,
    relationships:<TopicRelationshipAIWorkspace/>
  }[mode]

  return(
    <div className="ad">
      <button className="mobileMenu" aria-label="Open admin navigation" onClick={()=>setMobileNav(true)}>☰</button>
      {mobileNav&&<button className="mobileScrim" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>}
      <aside className={mobileNav?'mobileOpen':''}>
        <div className="brand">
          <b>H</b><strong>havan</strong><small>Study Planner</small>
        </div>
        <label>ACADEMIC CONTROL</label>
        {navigation.map(item=><button key={item.mode} className={mode===item.mode?'sel':''} onClick={()=>selectMode(item.mode)}>{item.icon} {item.label}</button>)}
        <footer>
          <a href="/student" className="adminStudentLink">Open student surface ↗</a>
          Havan academic workspace
          <br/>
          <small>Management → registry → quality → student planner</small>
        </footer>
      </aside>
      <main>{workspace}</main>
    </div>
  )
}
