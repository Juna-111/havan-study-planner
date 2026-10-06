'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'

export default function AcademicCatalogRequest({ universityId }: { universityId?: string }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'UNIVERSITY' | 'CURRICULUM'>('UNIVERSITY')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [version, setVersion] = useState('1.0')
  const [year, setYear] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function chooseType(next: 'UNIVERSITY' | 'CURRICULUM') {
    setType(next)
    setName('')
    setCode('')
    setVersion('1.0')
    setYear('')
    setMessage('')
  }

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
      setMessage('Request sent for admin review.')
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
    <section className="academic-request">
      <button type="button" className="academic-request-toggle" onClick={() => setOpen((value) => !value)}>
        <span>
          <strong>Can’t find your university or curriculum?</strong>
          <small>Add it to the review queue. Your setup stays simple and the shared catalog stays controlled.</small>
        </span>
        <b>{open ? 'Close' : 'Add missing option'}</b>
      </button>

      {open && (
        <div className="academic-request-body">
          <div className="academic-request-tabs" role="tablist" aria-label="Missing academic option">
            <button type="button" className={type === 'UNIVERSITY' ? 'active' : ''} onClick={() => chooseType('UNIVERSITY')}>
              University
            </button>
            <button type="button" className={type === 'CURRICULUM' ? 'active' : ''} disabled={!universityId} onClick={() => chooseType('CURRICULUM')}>
              Curriculum
            </button>
          </div>

          <label className="app-field">
            {type === 'UNIVERSITY' ? 'University name' : 'Curriculum name'}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={type === 'UNIVERSITY' ? 'Addis Ababa University' : '2025 Freshman Curriculum'}
            />
          </label>

          {type === 'UNIVERSITY' ? (
            <label className="app-field">
              University code <span>(optional)</span>
              <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="AAU" />
            </label>
          ) : (
            <div className="academic-request-grid">
              <label className="app-field">
                Version
                <input value={version} onChange={(event) => setVersion(event.target.value)} />
              </label>
              <label className="app-field">
                Academic year <span>(optional)</span>
                <input value={year} onChange={(event) => setYear(event.target.value)} placeholder="2025/26" />
              </label>
            </div>
          )}

          <button
            type="button"
            className="academic-request-submit"
            disabled={busy || !name.trim() || (type === 'CURRICULUM' && !universityId)}
            onClick={submit}
          >
            {busy ? 'Sending…' : 'Send request'}
          </button>

          {message && <p className="app-meta">{message}</p>}
        </div>
      )}
    </section>
  )
}
