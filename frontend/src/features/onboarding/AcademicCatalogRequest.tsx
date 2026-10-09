'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'

export default function AcademicCatalogRequest({ universityId }: { universityId?: string }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'UNIVERSITY' | 'STREAM'>('UNIVERSITY')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function chooseType(next: 'UNIVERSITY' | 'STREAM') {
    setType(next)
    setName('')
    setCode('')
    setMessage('')
  }

  async function submit() {
    if (!name.trim() || (type === 'STREAM' && (!universityId || !code.trim()))) return

    setBusy(true)
    setMessage('')

    try {
      await apiFetch('/academic-catalog-requests', {
        method: 'POST',
        body: JSON.stringify({
          request_type: type,
          university_id: type === 'STREAM' ? Number(universityId) : null,
          name: name.trim(),
          code: type === 'UNIVERSITY' ? code.trim() || null : null,
        }),
      })
      setMessage('Request sent for admin review.')
      setName('')
      setCode('')
      setCode('')
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
        <strong>Can’t find your university or stream?</strong>
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
            <button type="button" className={type === 'STREAM' ? 'active' : ''} disabled={!universityId} onClick={() => chooseType('STREAM')}>
              Stream
            </button>
          </div>

          <label className="app-field">
            {type === 'UNIVERSITY' ? 'University name' : 'Stream / department name'}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={type === 'UNIVERSITY' ? 'Addis Ababa University' : 'Natural Science'}
            />
          </label>

          {type === 'UNIVERSITY' ? (
            <label className="app-field">
              University code <span>(optional)</span>
              <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="AAU" />
            </label>
          ) : <label className="app-field">Stream code<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="NAT" /></label>}

          <button
            type="button"
            className="academic-request-submit"
            disabled={busy || !name.trim() || (type === 'STREAM' && (!universityId || !code.trim()))}
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
