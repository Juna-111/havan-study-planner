'use client'

import {useEffect, useMemo, useState} from 'react'
import {apiFetch} from '../../lib/api'

type Severity = 'error' | 'warning' | 'info'
type Issue = {
  severity: Severity
  entity_type: string
  entity_id: number
  title: string
  message: string
}

const entityPath: Record<string, string> = {
  university: 'universities',
  curriculum: 'curriculums',
  stream: 'streams',
  course: 'courses',
  chapter: 'chapters',
  topic: 'topics',
  relationship: 'relationships',
}

function issueAction(issue: Issue) {
  if (issue.title === 'Missing academic content') return 'Review parent'
  if (issue.title.includes('relationship')) return 'Review mapping'
  return 'Review workspace'
}
type Quality = {
  summary: {total_records:number; issues:number; errors:number; warnings:number; info:number; active_curriculums:number}
  counts: Record<string, number>
  readiness: {status: "ready"|"warning"|"error"; active_courses:number; ready_courses:number; active_topics:number; invalid_topics:number; prerequisite_cycle_topics:number}
  issues: Issue[]
}

export default function AcademicQuality(){
  const [data,setData]=useState<Quality|null>(null)
  const [filter,setFilter]=useState<'all'|Severity>('all')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  async function load(){
    setLoading(true)
    setError('')
    try{setData(await apiFetch<Quality>('/academic-quality'))}
    catch(err){setError(err instanceof Error?err.message:'Could not load academic quality data.')}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[])

  const issues=useMemo(
    ()=>data?.issues.filter(item=>filter==='all'||item.severity===filter)??[],
    [data,filter]
  )

  function openIssue(issue: Issue) {
    const mode = issue.entity_type === 'university' || issue.entity_type === 'curriculum' || issue.entity_type === 'stream'
      ? 'setup'
      : issue.entity_type === 'relationship'
        ? 'mapping'
        : 'freshman'
    window.location.href = `/admin?mode=${mode}`
  }

  const health = !data ? 'Checking academic data…'
    : data.summary.errors ? 'Action needed'
    : data.summary.warnings ? 'Review recommended'
    : 'Academic data is clean'

  return <div className="qualityPage">
    <header className="qualityHeader">
      <div><span>HAVAN STUDY PLANNER</span><h1>Academic Quality</h1><p>Check the academic data that feeds Havan’s deterministic planner.</p></div>
      <button className="primary" onClick={load} disabled={loading}>{loading?'Checking…':'↻ Refresh checks'}</button>
    </header>

    {error&&<div className="alert">{error}</div>}

    {loading&&!data?<div className="qualityLoading">Running academic checks…</div>:data&&<>
      <section className="qualityHero">
        <div><span>ACADEMIC HEALTH</span><h2>{health}</h2><p>Quality checks inspect structure, completeness, relationships, and planner-relevant consistency.</p></div>
        <strong>{data.summary.issues}<small>issues found</small></strong>
      </section>

      <section className="qualityStats">
        <article><span>Planner readiness</span><b>{data.readiness.status === 'ready' ? 'Ready' : data.readiness.status === 'warning' ? 'Review' : 'Blocked'}</b><small>{data.readiness.ready_courses}/{data.readiness.active_courses} active courses ready</small></article>
        <article><span>Errors</span><b>{data.summary.errors}</b><small>Needs correction</small></article>
        <article><span>Warnings</span><b>{data.summary.warnings}</b><small>Review recommended</small></article>
        <article><span>Info</span><b>{data.summary.info}</b><small>Data gaps</small></article>
        <article><span>Records</span><b>{data.summary.total_records}</b><small>Across academic data</small></article>
      </section>

      <section className="qualityGrid">
        <article className="qualityCard">
          <header><div><span>ACADEMIC STRUCTURE</span><h2>Records in the system</h2></div><b>{data.summary.active_curriculums} active curricula</b></header>
          <div className="countGrid">{Object.entries(data.counts).map(([key,value])=><div key={key}><span>{key.replaceAll('_',' ')}</span><strong>{value}</strong></div>)}</div>
        </article>

        <article className="qualityCard">
          <header><div><span>ISSUE REVIEW</span><h2>What needs attention?</h2></div></header>
          <div className="qualityFilters">{(['all','error','warning','info'] as const).map(value=><button key={value} className={filter===value?'selected':''} onClick={()=>setFilter(value)}>{value==='all'?'All':value[0].toUpperCase()+value.slice(1)}</button>)}</div>
          {issues.length===0?<div className="qualityEmpty"><b>✓</b><strong>No matching issues</strong><span>The academic structure passed the selected checks.</span></div>:<div className="issueList">{issues.map((issue,index)=><button type="button" className="issue issueActionCard" key={issue.entity_type+'-'+issue.entity_id+'-'+issue.title+'-'+index} onClick={()=>openIssue(issue)}><span className={'severity '+issue.severity}>{issue.severity}</span><div className="issueBody"><strong>{issue.title}</strong><p>{issue.message}</p><small>{issue.entity_type} #{issue.entity_id}</small></div><span className="issueFix">{issueAction(issue)} <b>→</b></span></button>)}</div>}
        </article>
      </section>

      <div className="qualityNote"><strong>How this fits Havan</strong><span>Academic Data → Quality Checks → Admin Review → Clean Data → Planner Engine → Student Plan</span></div>
    </>}
  </div>
}
