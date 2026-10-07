'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

type Course = { id: number; code: string; name: string }
type Chapter = { id: number; name: string; order_index: number; status: string }
type Topic = { id: number; name: string; difficulty: number; status: string }

export default function ContentScreen() {
  const [courses, setCourses] = useState<Course[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [courseId, setCourseId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [error, setError] = useState('')

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

  return (
    <section>
      <header className={styles.header}>
        <span>ACADEMIC CONTENT</span>
        <h1>Course content registry</h1>
        <p>Chapters, topics, difficulty, and critical points are maintained through the course TXT/MD source. This screen verifies the imported hierarchy.</p>
      </header>
      {error && <div className={styles.alert}>{error}</div>}
      <div className={styles.notice}>
        <h2>Automatic content ingestion</h2>
        <p>Use Import for course TXT/MD updates. Manual chapter/topic editing is disabled so the uploaded source remains authoritative.</p>
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
        {chapters.map((chapter) => <div className={styles.row} key={chapter.id}><div><b>{chapter.order_index}. {chapter.name}</b><small>{chapter.status} · Chapter ID #{chapter.id}</small></div><span>Source-managed</span></div>)}
      </div>}
      {chapterId && <div className={styles.list}>
        <div className={styles.crudHead}><div><h2>{topics.length} topics</h2><p>Imported topics and their difficulty.</p></div></div>
        {topics.map((topic) => <div className={styles.row} key={topic.id}><div><b>{topic.name}</b><small>{topic.status} · Difficulty {topic.difficulty}/5 · Topic ID #{topic.id}</small></div><span>Source-managed</span></div>)}
      </div>}
    </section>
  )
}