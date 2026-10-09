'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type Course = { id: number; code: string; name: string }
type Chapter = { id: number; name: string; order_index: number; status: string; description?: string | null; important_points?: string | null }
type Topic = { id: number; chapter_id: number; name: string; difficulty: number; estimated_study_minutes: number; exam_importance: number; conceptual_importance: number; status: string; description?: string | null }

export default function ContentScreen({ onImport }: { onImport?: () => void }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [courseId, setCourseId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [error, setError] = useState('')
  const [editingTopic, setEditingTopic] = useState<number | null>(null)
  const [editingChapter, setEditingChapter] = useState<number | null>(null)
  const [chapterDraft, setChapterDraft] = useState({ description: '', important_points: '', status: 'ACTIVE' })
  const [draft, setDraft] = useState({ estimated_study_minutes: 30, exam_importance: 0.5, conceptual_importance: 0.5, status: 'ACTIVE', description: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  useEffect(() => {
    apiFetch<{ items: Course[] }>('/courses?page=1&page_size=100').then((r) => setCourses(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load courses.'))
  }, [])

  useEffect(() => {
    setChapterId('')
    setTopics([])
    if (!courseId) { setChapters([]); return }
    apiFetch<{ items: Chapter[] }>('/chapters?course_id=' + courseId + '&page=1&page_size=100')
      .then((r) => setChapters(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load chapters.'))
  }, [courseId])

  useEffect(() => {
    if (!chapterId) { setTopics([]); return }
    apiFetch<{ items: Topic[] }>('/topics?chapter_id=' + chapterId + '&page=1&page_size=100')
      .then((r) => setTopics(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load topics.'))
  }, [chapterId])

  function editTopic(topic: Topic) {
    setEditingTopic(topic.id)
    setSaved('')
    setDraft({
      estimated_study_minutes: topic.estimated_study_minutes,
      exam_importance: topic.exam_importance,
      conceptual_importance: topic.conceptual_importance,
      status: topic.status,
      description: topic.description || '',
    })
  }

  async function saveTopic(topicId: number) {
    setSaving(true)
    setError('')
    try {
      const updated = await apiFetch<Topic>(`/topics/${topicId}`, { method: 'PATCH', body: JSON.stringify(draft) })
      setTopics((current) => current.map((topic) => topic.id === topicId ? updated : topic))
      setEditingTopic(null)
      setSaved('Study settings saved. Your source-file content stays intact.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save topic settings.')
    } finally {
      setSaving(false)
    }
  }

  async function saveChapter(chapterId: number) {
    setSaving(true)
    setError('')
    try {
      const updated = await apiFetch<Chapter>(`/chapters/${chapterId}`, { method: 'PATCH', body: JSON.stringify(chapterDraft) })
      setChapters((current) => current.map((chapter) => chapter.id === chapterId ? updated : chapter))
      setEditingChapter(null)
      setSaved('Chapter notes and status saved.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save chapter settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <header className={styles.header}>
        <span>ACADEMIC CONTENT</span>
        <h1>Course content registry</h1>
        <p>Uploaded files create the course structure. After import, admins can edit course details, chapter notes and availability, and topic study settings.</p>
      </header>
      {error && <div className={styles.alert}>{error}</div>}
      {saved && <div className={styles.notice}>{saved}</div>}
      <div className={styles.notice}>
        <h2>Automatic content ingestion</h2>
        <p>Uploaded names and source content stay intact. Local notes, study estimates, importance, and availability can be edited below.</p>
        {onImport && <button className={styles.primary} onClick={onImport}>Import updated content</button>}
      </div>
      <div className={styles.selectors}>
        <label>Course<select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Choose Course Registry course</option>
          {courses.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select></label>
        <label>Chapter<select value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={!courseId}>
          <option value="">Choose chapter</option>
          {chapters.map((item) => <option key={item.id} value={item.id}>{item.order_index}. {item.name}</option>)}
        </select></label>
      </div>
      {courseId && <div className={styles.list}>
        <div className={styles.crudHead}><div><h2>{chapters.length} chapters</h2><p>Imported chapters for the selected canonical course.</p></div></div>
        {chapters.map((chapter) => <article className={styles.topicAdminCard} key={chapter.id}>
          <div className={styles.topicAdminSummary}><div><b>{chapter.order_index}. {chapter.name}</b><small>{chapter.status} · Chapter ID #{chapter.id}</small></div><button className={styles.rowAction} onClick={() => { setEditingChapter(chapter.id); setChapterDraft({ description: chapter.description || '', important_points: chapter.important_points || '', status: chapter.status }) }}>{editingChapter === chapter.id ? 'Editing' : 'Edit chapter notes'}</button></div>
          {editingChapter === chapter.id && <div className={styles.topicEditor}>
            <label>Description<textarea value={chapterDraft.description} onChange={(event) => setChapterDraft({ ...chapterDraft, description: event.target.value })} maxLength={10000} /></label>
            <label>Important points<textarea value={chapterDraft.important_points} onChange={(event) => setChapterDraft({ ...chapterDraft, important_points: event.target.value })} maxLength={10000} /></label>
            <label>Status<select value={chapterDraft.status} onChange={(event) => setChapterDraft({ ...chapterDraft, status: event.target.value })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
            <div className={styles.actions}><button onClick={() => setEditingChapter(null)}>Cancel</button><button className={styles.primary} disabled={saving} onClick={() => void saveChapter(chapter.id)}>{saving ? 'Saving…' : 'Save chapter settings'}</button></div>
          </div>}
        </article>)}
      </div>}
      {chapterId && <div className={styles.list}>
        <div className={styles.crudHead}><div><h2>{topics.length} topics</h2><p>Imported topics and their difficulty.</p></div></div>
        <p className={styles.appHint}>Tune the study estimate and importance to match your local teaching plan. Imported topic names and source notes stay unchanged.</p>
        {topics.map((topic) => <article className={styles.topicAdminCard} key={topic.id}>
          <div className={styles.topicAdminSummary}><div><b>{topic.name}</b><small>{topic.status} · Difficulty {topic.difficulty}/5 · {topic.estimated_study_minutes} min</small></div><button className={styles.rowAction} onClick={() => editTopic(topic)}>{editingTopic === topic.id ? 'Editing' : 'Edit study settings'}</button></div>
          {editingTopic === topic.id && <div className={styles.topicEditor}>
            <label>Study time (minutes)<input type="number" min="1" max="1440" value={draft.estimated_study_minutes} onChange={(event) => setDraft({ ...draft, estimated_study_minutes: Number(event.target.value) })} /></label>
            <label>Exam importance (0–1)<input type="number" min="0" max="1" step="0.1" value={draft.exam_importance} onChange={(event) => setDraft({ ...draft, exam_importance: Number(event.target.value) })} /></label>
            <label>Concept importance (0–1)<input type="number" min="0" max="1" step="0.1" value={draft.conceptual_importance} onChange={(event) => setDraft({ ...draft, conceptual_importance: Number(event.target.value) })} /></label>
            <label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
            <label className={styles.topicDescription}>Admin note<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={10000} placeholder="Optional local teaching note" /></label>
            <div className={styles.actions}><button onClick={() => setEditingTopic(null)}>Cancel</button><button className={styles.primary} disabled={saving} onClick={() => void saveTopic(topic.id)}>{saving ? 'Saving…' : 'Save study settings'}</button></div>
          </div>}
        </article>)}
      </div>}
    </section>
  )
}
