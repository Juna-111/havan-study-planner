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
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [lastImportedCount, setLastImportedCount] = useState(0)

  function clearResult() {
    setPreview([])
    setMessage('')
    setError('')
    setLastImportedCount(0)
  }

  async function previewImport() {
    if (!file) {
      setError('Choose a .txt or .md file.')
      return
    }
    setBusy('preview')
    setError('')
    setMessage('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await apiFetch<Preview[]>(
        '/freshman-registry-import/preview?content_version=' + encodeURIComponent(version.trim() || '1.0'),
        { method: 'POST', body: fd },
      )
      setPreview(result)
      setMessage(result.length + ' course' + (result.length === 1 ? '' : 's') + ' parsed. Nothing is saved yet.')
    } catch (e) {
      setPreview([])
      setError(e instanceof Error ? e.message : 'Could not preview the file.')
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    if (!preview.length) return
    setBusy('save')
    setError('')
    try {
      const result = await apiFetch<Preview[]>('/freshman-registry-import/commit', {
        method: 'POST',
        body: JSON.stringify(preview),
      })
      setMessage(result.length + ' course' + (result.length === 1 ? '' : 's') + ' imported successfully.')
      setLastImportedCount(result.length)
      setPreview([])
      setFile(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the import. No records were saved.')
    } finally {
      setBusy(null)
    }
  }

  const topicCount = preview.reduce((sum, course) => sum + course.chapters.reduce((chapterSum, chapter) => chapterSum + chapter.topics.length, 0), 0)

  return (
    <section>
      <header className={styles.header}>
        <span>ACADEMIC CONTENT · IMPORT</span>
        <h1>Import academic content safely</h1>
        <p>Preview the established Course → Chapter → Topic format before anything is written to the registry.</p>
      </header>
      {(message || error) && <div className={error ? styles.alert : styles.notice}>{error || message}</div>}
      <div className={styles.importStatus}>
        <div>
          <span>IMPORT WORKFLOW</span>
          <strong>{busy === 'preview' ? 'Parsing file' : busy === 'save' ? 'Saving to Course Registry' : preview.length ? 'Preview ready' : lastImportedCount ? String(lastImportedCount) + ' ' + (lastImportedCount === 1 ? 'course' : 'courses') + ' imported' : file ? 'File ready' : 'Waiting for a course file'}</strong>
        </div>
        <small>{preview.length ? 'No registry record is written until you confirm the import.' : lastImportedCount ? 'The Course Registry confirmed the latest import request.' : 'The status reflects the actual import state on this screen.'}</small>
      </div>
      <div className={styles.importCard}>
        <label>Content version<input value={version} onChange={(e) => setVersion(e.target.value)} /></label>
        <div className={styles.filePicker}>
          <div>
            <span className={styles.fieldKicker}>SOURCE FILE</span>
            <strong>{file ? file.name : 'No course file selected'}</strong>
            <small>.txt or .md · UTF-8 · maximum 5 MB</small>
          </div>
          <label className={styles.fileButton}>
            <span>{file ? 'Change file' : 'Choose course file'}</span>
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={(e) => { setFile(e.target.files?.[0] || null); clearResult() }}
            />
          </label>
        </div>
        <pre>{'Course: [PHY101] Physics\nChapter: Measurement\n  • Physical quantities [3]\n  • Units and dimensions [2]'}</pre>
        <div className={styles.actions}>
          <button disabled={busy !== null || !file} onClick={previewImport}>{busy === 'preview' ? 'Parsing…' : 'Preview import'}</button>
          <button className={styles.primary} disabled={busy !== null || !preview.length} onClick={save}>{busy === 'save' ? 'Saving…' : 'Confirm and save'}</button>
        </div>
      </div>
      {preview.length > 0 && (
        <div className={styles.preview}>
          <h2>Import review</h2>
          <p>{preview.length} courses · {topicCount} topics. Duplicate registry identities are rejected before saving.</p>
          {preview.map((course) => (
            <article key={course.code + '-' + course.content_version}>
              <b>{course.code} · {course.name}</b>
              <small>Version {course.content_version}</small>
              {course.chapters.map((chapter) => (
                <div className={styles.indent} key={chapter.name}>
                  <strong>{chapter.name}</strong>
                  {chapter.topics.map((topic) => <span key={topic.name}>{topic.name} · difficulty {topic.difficulty}</span>)}
                </div>
              ))}
            </article>
          ))}
          <button onClick={clearResult}>Discard preview</button>
        </div>
      )}
    </section>
  )
}
