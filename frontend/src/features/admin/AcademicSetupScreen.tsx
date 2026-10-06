'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type University = { id: number; name: string; code: string; status: string }
type Curriculum = { id: number; university_id: number; name: string; version: string; academic_year?: string | null; status: string }
type Request = { id: number; request_type: 'UNIVERSITY' | 'CURRICULUM'; university_id?: number | null; name: string; code?: string | null; version?: string | null; academic_year?: string | null; status: string }

export default function AcademicSetupScreen() {
  const [universities, setUniversities] = useState<University[]>([])
  const [curriculums, setCurriculums] = useState<Curriculum[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [universityId, setUniversityId] = useState('')
  const [universityName, setUniversityName] = useState('')
  const [universityCode, setUniversityCode] = useState('')
  const [curriculumName, setCurriculumName] = useState('')
  const [curriculumVersion, setCurriculumVersion] = useState('1.0')
  const [curriculumYear, setCurriculumYear] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const [u, c, r] = await Promise.all([
        apiFetch<{ items: University[] }>('/universities?page=1&page_size=100'),
        apiFetch<{ items: Curriculum[] }>('/curriculums?page=1&page_size=100'),
        apiFetch<Request[]>('/academic-catalog-requests'),
      ])
      setUniversities(u.items); setCurriculums(c.items); setRequests(r)
      if (!universityId && u.items[0]) setUniversityId(String(u.items[0].id))
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not load academic catalog.') }
  }
  useEffect(() => { load() }, [])

  async function addUniversity() {
    if (!universityName.trim() || !universityCode.trim()) return
    setBusy('university'); setError('')
    try {
      await apiFetch('/universities', { method: 'POST', body: JSON.stringify({ name: universityName.trim(), code: universityCode.trim().toUpperCase(), status: 'ACTIVE' }) })
      setUniversityName(''); setUniversityCode(''); setMessage('University added to the Havan catalog.'); await load()
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not add university.') } finally { setBusy('') }
  }

  async function addCurriculum() {
    if (!universityId || !curriculumName.trim() || !curriculumVersion.trim()) return
    setBusy('curriculum'); setError('')
    try {
      await apiFetch('/curriculums', { method: 'POST', body: JSON.stringify({ university_id: Number(universityId), name: curriculumName.trim(), version: curriculumVersion.trim(), academic_year: curriculumYear.trim() || null, status: 'ACTIVE' }) })
      setCurriculumName(''); setCurriculumYear(''); setMessage('Curriculum added to the selected university.'); await load()
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not add curriculum.') } finally { setBusy('') }
  }

  async function review(id: number, status: 'APPROVED' | 'REJECTED') {
    setBusy('request-' + id); setError('')
    try {
      await apiFetch('/academic-catalog-requests/' + id, { method: 'PATCH', body: JSON.stringify({ status }) })
      setMessage(status === 'APPROVED' ? 'Request approved and added to the catalog.' : 'Request rejected.'); await load()
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not review request.') } finally { setBusy('') }
  }

  return (
    <section>
      <header className={styles.header}>
        <span>SETUP · ACADEMIC CATALOG</span>
        <h1>Add universities and curricula faster</h1>
        <p>Create academic options once, then students can select them during setup. Student requests for missing options appear here for approval.</p>
      </header>
      {(message || error) && <div className={error ? styles.alert : styles.notice}>{error || message}</div>}
      <div className={styles.quickGrid}>
        <div className={styles.quickCard}>
          <h2>Add university</h2><p>Name is required. Code is optional and Havan can generate one.</p>
          <label>Name<input value={universityName} onChange={(e) => setUniversityName(e.target.value)} placeholder='Addis Ababa University' /></label>
          <label>Code (optional)<input value={universityCode} onChange={(e) => setUniversityCode(e.target.value)} placeholder='AAU' /></label>
          <button className={styles.primary} disabled={busy === 'university' || !universityName.trim()} onClick={addUniversity}>{busy === 'university' ? 'Adding…' : 'Add university'}</button>
        </div>
        <div className={styles.quickCard}>
          <h2>Add curriculum</h2><p>Pick the university first. Version keeps identities separate.</p>
          <label>University<select value={universityId} onChange={(e) => setUniversityId(e.target.value)}><option value=''>Choose university</option>{universities.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label>Curriculum name<input value={curriculumName} onChange={(e) => setCurriculumName(e.target.value)} placeholder='2025 Freshman Curriculum' /></label>
          <div className={styles.twoFields}><label>Version<input value={curriculumVersion} onChange={(e) => setCurriculumVersion(e.target.value)} /></label><label>Academic year<input value={curriculumYear} onChange={(e) => setCurriculumYear(e.target.value)} placeholder='2025/26' /></label></div>
          <button className={styles.primary} disabled={busy === 'curriculum' || !universityId || !curriculumName.trim()} onClick={addCurriculum}>{busy === 'curriculum' ? 'Adding…' : 'Add curriculum'}</button>
        </div>
      </div>
      <div className={styles.catalog}>
        <div className={styles.crudHead}><div><h2>Current universities</h2><p>These are the options students see in setup.</p></div><b>{universities.length}</b></div>
        {universities.map((item) => <div className={styles.row} key={item.id}><div><b>{item.code}</b><span>{item.name}</span></div><small>{curriculums.filter((c) => c.university_id === item.id).length} curricula</small></div>)}
      </div>
      <div className={styles.preview}>
        <h2>Student requests</h2><p>Students can request missing options without creating unsafe catalog records themselves.</p>
        {!requests.length && <p className={styles.empty}>No requests waiting.</p>}
        {requests.map((item) => <div className={styles.requestRow} key={item.id}><div><b>{item.request_type === 'UNIVERSITY' ? 'University' : 'Curriculum'} · {item.name}</b><span>{item.code || item.version || 'Details not supplied'}</span><small>{item.status}{item.academic_year ? ' · ' + item.academic_year : ''}</small></div>{item.status === 'PENDING' && <div className={styles.actions}><button className={styles.primary} disabled={busy === 'request-' + item.id} onClick={() => review(item.id, 'APPROVED')}>Approve</button><button className={styles.danger} disabled={busy === 'request-' + item.id} onClick={() => review(item.id, 'REJECTED')}>Reject</button></div>}</div>)}
      </div>
    </section>
  )
}