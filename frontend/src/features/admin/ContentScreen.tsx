'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import CrudList, { entityConfigs, type EntityKey } from './CrudList'
import styles from './admin.module.css'

type Item = { id: number; name: string; code?: string }

export default function ContentScreen() {
  const [entity, setEntity] = useState<EntityKey>('courses')
  const [courseId, setCourseId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [courses, setCourses] = useState<Item[]>([])
  const [chapters, setChapters] = useState<Item[]>([])

  useEffect(() => {
    apiFetch<{ items: Item[] }>('/courses?page=1&page_size=100')
      .then((value) => setCourses(value.items))
      .catch(() => setCourses([]))
  }, [])

  useEffect(() => {
    if (courseId) {
      apiFetch<{ items: Item[] }>(
        '/chapters?course_id=' + courseId + '&page=1&page_size=100',
      ).then((value) => setChapters(value.items))
    } else {
      setChapters([])
    }
  }, [courseId])

  const config = entityConfigs.find((item) => item.key === entity)!

  return (
    <section>
      <header className={styles.header}>
        <span>CONTENT</span>
        <h1>Courses, chapters & topics</h1>
        <p>Edit the reusable catalog from one focused workspace.</p>
      </header>

      <div className={styles.tabs}>
        {entityConfigs.map((item) => (
          <button
            className={entity === item.key ? styles.active : ''}
            key={item.key}
            onClick={() => setEntity(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {entity === 'chapters' && (
        <label className={styles.scope}>
          Course
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Choose a course</option>
            {courses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code || ''} · {item.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {entity === 'topics' && (
        <label className={styles.scope}>
          Chapter
          <select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
            <option value="">Choose a chapter</option>
            {chapters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <CrudList
        config={config}
        parentId={
          entity === 'chapters'
            ? courseId
            : entity === 'topics'
              ? chapterId
              : undefined
        }
      />
    </section>
  )
}
