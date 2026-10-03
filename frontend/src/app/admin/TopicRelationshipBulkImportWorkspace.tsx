'use client'

import {useState} from 'react'
import {apiFetch} from '../../lib/api'

type Preview={
  line_number:number
  source_ref:string
  target_ref:string
  relationship_type:string
  strength:number
  notes:string|null
  source_topic_id:number
  target_topic_id:number
  source_course_code:string
  target_course_code:string
  source_topic_name:string
  target_topic_name:string
  existing:boolean
}

export default function TopicRelationshipBulkImportWorkspace(){
  const [file,setFile]=useState<File|null>(null)
  const [preview,setPreview]=useState<Preview[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  async function previewFile(){
    if(!file){setError('Choose a .txt or .md relationship file first.');return}
    setBusy(true);setError('');setMessage('')
    try{
      const formData=new FormData()
      formData.append('file',file)
      const data=await apiFetch<Preview[]>('/topic-relationship-import/preview',{method:'POST',body:formData})
      setPreview(data)
      setMessage('Preview ready. Nothing has been saved yet.')
    }catch(err){
      setError(err instanceof Error?err.message:'Could not validate the relationship file.')
      setPreview([])
    }finally{setBusy(false)}
  }

  async function commit(){
    if(!preview.length)return
    setBusy(true);setError('');setMessage('')
    try{
      const result=await apiFetch<{created:number;skipped_existing:number}>(
        '/topic-relationship-import/commit',
        {method:'POST',body:JSON.stringify({items:preview})}
      )
      setMessage(result.created+' relationship'+(result.created===1?'':'s')+' imported. '+result.skipped_existing+' existing relationship'+(result.skipped_existing===1?' was':'s were')+' skipped.')
      setPreview([])
      setFile(null)
    }catch(err){
      setError(err instanceof Error?err.message:'Could not save the relationships.')
    }finally{setBusy(false)}
  }

  return <section className='relationshipImportCard'>
    <div className='relationshipImportHead'>
      <div>
        <span>BULK IMPORT</span>
        <h2>Import topic relationships</h2>
        <p>Load many relationships at once using the same preview-first workflow as Course Registry.</p>
      </div>
      <strong>TXT · MD</strong>
    </div>

    {message&&<div className='notice'>{message}</div>}
    {error&&<div className='alert'>{error}</div>}

    <div className='relationshipImportGrid'>
      <div>
        <label className='relationshipFileBox'>
          <span>Relationship file</span>
          <input type='file' accept='.txt,.md,text/plain,text/markdown' onChange={e=>{setFile(e.target.files?.[0]??null);setPreview([]);setMessage('');setError('')}}/>
          <b>{file?file.name:'Choose a .txt or .md file'}</b>
          <small>UTF-8 · maximum 5 MB</small>
        </label>

        <pre className='relationshipFormat'>{`# Havan topic relationships

Relationship: PHY101:42 -> MAT101:17 | prerequisite | 0.9 | Algebra foundation
Relationship: PHY101:51 -> MAT101:22 | conceptual | 0.7
Relationship: CHE101:18 -> BIO101:31 | cross_course | 0.8 | Shared concept`}</pre>

        <div className='relationshipImportRules'>
          <b>Stable references only</b>
          <span>CourseCode:TopicId</span>
          <span>Supported: prerequisite, conceptual, cross_course, related, revision</span>
        </div>

        <button className='workspacePrimary relationshipImportButton' disabled={busy||!file} onClick={previewFile}>
          {busy?'Validating…':'Preview relationships'}
        </button>
      </div>

      {preview.length>0&&<div className='relationshipPreview'>
        <div className='relationshipPreviewHead'>
          <div><span>DRY RUN</span><h3>Review before saving</h3></div>
          <b>{preview.length} relationship{preview.length===1?'':'s'}</b>
        </div>

        <div className='relationshipPreviewList'>
          {preview.map(item=><article key={item.line_number+'-'+item.source_ref+'-'+item.target_ref+'-'+item.relationship_type}>
            <div>
              <small>Line {item.line_number} · {item.relationship_type} · strength {item.strength}</small>
              <b>{item.source_course_code}:{item.source_topic_id} · {item.source_topic_name}</b>
              <span>→</span>
              <b>{item.target_course_code}:{item.target_topic_id} · {item.target_topic_name}</b>
            </div>
            <strong className={item.existing?'relationshipExisting':'relationshipNew'}>{item.existing?'Already exists':'New'}</strong>
          </article>)}
        </div>

        <button className='workspacePrimary relationshipImportButton' disabled={busy} onClick={commit}>
          {busy?'Saving…':'Import validated relationships'}
        </button>
      </div>}
    </div>
  </section>
}
