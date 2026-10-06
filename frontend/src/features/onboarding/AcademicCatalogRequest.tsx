'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'

export default function AcademicCatalogRequest({ universityId }: { universityId?: string }) {
  const [type, setType] = useState<'UNIVERSITY' | 'CURRICULUM'>('UNIVERSITY')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [version, setVersion] = useState('1.0')
  const [year, setYear] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!name.trim() || (type === 'CURRICULUM' && !universityId)) return
    setBusy(true)
    setMessage('')
    try {
      await apiFetch('/academic-catalog-requests', {
        method: 'POST',
        body: JSON.stringify({
          request_type: type,
          university_id: type === 'CURRICULUM' ? Number(universityId) : null,
          name: name.trim(),
          code: type === 'UNIVERSITY' ? code.trim() || null : null,
          version: type === 'CURRICULUM' ? version.trim() : null,
          academic_year: type === 'CURRICULUM' ? year.trim() || null : null,
        }),
      })
      setMessage('Request sent. Havan will add it to the catalog after review.')
      setName('')
      setCode('')
      setYear('')
    } catch (value) {
      setMessage(value instanceof Error ? value.message : 'Could not send the request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="academic-request">
      <div>
        <strong>Can’t find your {type === 'UNIVERSITY' ? 'university' : 'curriculum'}?</strong>
        <p>Request it here. An admin will review it and add it to Havan’s shared catalog.</p>
      </div>
      <div className="academic-request-tabs">
        <button type="button" className={type === 'UNIVERSITY' ? 'active' : ''} onClick={() => setType('UNIVERSITY')}>University</button>
        <button type="button" className={type === 'CURRICULUM' ? 'active' : ''} disabled={!universityId} onClick={() => setType('CURRICULUM')}>Curriculum</button>
      </div>
      <label className="app-field">
        {type === 'UNIVERSITY' ? 'University name' : 'Curriculum name'}
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={type === 'UNIVERSITY' ? 'University name' : 'Curriculum name'} />
      </label>
      {type === 'UNIVERSITY' ? (
        <label className="app-field">University code<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Optional, e.g. AAU" /></label>
      ) : (
        <div className="academic-request-grid">
          <label className="app-field">Version<input value={version} onChange={(event) => setVersion(event.target.value)} /></label>
          <label className="app-field">Academic year<input value={year} onChange={(event) => setYear(event.target.value)} placeholder="2025/26" /></label>
        </div>
      )}
      <button type="button" className="academic-request-submit" disabled={busy || !name.trim()} onClick={submit}>{busy ? 'Sending…' : 'Request addition'}</button>
      {message && <p className="app-meta">{message}</p>}
    </div>
  )
}
