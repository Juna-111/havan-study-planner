'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type Preview = {
  code: string
  name: string
  content_version: string
  category_codes: string[]
  chapters: { name: string; topics: { name: string; difficulty: number }[] }[]
}

export default function ImportScreen() {
  const [file, setFile] = useState<File | null>(null)
  const [version, setVersion] = useState('1.0')
  const [preview, setPreview] = useState<Preview[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function previewImport() {
    if (!file) {
      setError('Choose a .txt or .md file.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      setPreview(await apiFetch<Preview[]>('/freshman-registry-import/preview?content_version=' + encodeURIComponent(version), { method: 'POST', body: fd }))
      setMessage('Preview ready. Nothing is saved yet.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not preview the file.')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      await apiFetch('/freshman-registry-import/commit', { method: 'POST', body: JSON.stringify(preview) })
      setMessage('Import saved.')
      setPreview([])
      setFile(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the import.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <header className={styles.header}>
        <span>CONTENT · IMPORT</span>
        <h1>Import courses</h1>
        <p>Upload UTF-8 .txt or .md course files, review the hierarchy, then save it to the reusable registry.</p>
      </header>
      {(message || error) && <div className={error ? styles.alert : styles.notice}>{error || message}</div>}
      <div className={styles.importCard}>
        <label>
          Content version
          <input value={version} onChange={(e) => setVersion(e.target.value)} />
        </label>
        <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview([]) }} />
        <pre>{'Course: [Math 1011] Applied Mathematics I\nChapter: Measurement\n  • Physical quantities [3]\n  • Units and dimensions [2]'}</pre>
        <button className={styles.primary} disabled={busy || !file} onClick={previewImport}>
          {busy ? 'Working…' : 'Preview course'}
        </button>
      </div>
      {preview.length > 0 && (
        <div className={styles.preview}>
          <h2>Review before saving</h2>
          {preview.map((course, index) => (
            <div key={index}>
              <b>{course.code} · {course.name}</b>
              {course.chapters.map((chapter, chapterIndex) => (
                <div className={styles.indent} key={chapterIndex}>
                  <strong>{chapter.name}</strong>
                  {chapter.topics.map((topic, topicIndex) => (
                    <span key={topicIndex}>{topic.name} · difficulty {topic.difficulty}</span>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <div className={styles.actions}>
            <button onClick={() => setPreview([])}>Cancel</button>
            <button className={styles.primary} disabled={busy} onClick={save}>Confirm and save</button>
          </div>
        </div>
      )}
    </section>
  )
}
