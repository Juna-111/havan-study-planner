import { useEffect, useRef, useState } from 'react'
import { Card, Checkbox, Select } from '@/components/ui'
import { apiFetch } from '@/lib/api'

type Opt = { id: number; name: string; status?: string }
type Course = { id: number; code: string; name: string }
type Page<T> = { items: T[]; page: number; page_size: number; total: number; pages: number }

type Props = {
  course: Course
  checked: boolean
  start?: { chapter?: number; topic?: number }
  onToggle: (id: number, checked: boolean) => void
  onStart: (courseId: number, value: { chapter?: number; topic?: number }) => void
}

export default function CourseChoice({
  course, checked, start, onToggle, onStart,
}: {
  course: Course
  checked: boolean
  start?: { chapter?: number; topic?: number }
  onToggle: Props['onToggle']
  onStart: Props['onStart']
}) {
  const [chapters, setChapters] = useState<Opt[]>([])
  const [topics, setTopics] = useState<Opt[]>([])
  const [chapterLoading, setChapterLoading] = useState(false)
  const [topicLoading, setTopicLoading] = useState(false)
  const chapterRequest = useRef(0)
  const topicRequest = useRef(0)
  useEffect(() => {
    setChapters([])
    setTopics([])
    if (!checked) return
    const request = ++chapterRequest.current
    let cancelled = false
    setChapterLoading(true)
    apiFetch<Page<Opt>>('/chapters?course_id=' + course.id + '&page=1&page_size=100')
      .then((response) => {
        if (!cancelled && request === chapterRequest.current) setChapters(response.items.filter((item) => item.status === 'ACTIVE'))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled && request === chapterRequest.current) setChapterLoading(false)
      })
    return () => { cancelled = true }
  }, [checked, course.id])
  useEffect(() => {
    setTopics([])
    if (!start?.chapter) return
    const request = ++topicRequest.current
    let cancelled = false
    setTopicLoading(true)
    apiFetch<Page<Opt>>('/topics?chapter_id=' + start.chapter + '&page=1&page_size=100')
      .then((response) => {
        if (!cancelled && request === topicRequest.current) setTopics(response.items.filter((item) => item.status === 'ACTIVE'))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled && request === topicRequest.current) setTopicLoading(false)
      })
    return () => { cancelled = true }
  }, [start?.chapter])
  function handleChapter(value: string) {
    onStart(course.id, { chapter: value ? Number(value) : undefined })
  }
  function handleTopic(value: string) {
    onStart(course.id, { chapter: start?.chapter, topic: value ? Number(value) : undefined })
  }
  return (
    <Card>
      <Checkbox label={course.code + ' · ' + course.name} checked={checked} onChange={(value) => onToggle(course.id, value)} />
      {checked && (
        <div className="stack">
          <Select
            label="Current chapter (optional)"
            value={String(start?.chapter ?? '')}
            disabled={chapterLoading}
            onChange={handleChapter}
            options={[{ value: '', label: chapterLoading ? 'Loading chapters…' : 'Start from beginning' }, ...chapters.map((x) => ({ value: String(x.id), label: x.name }))]}
          />
          {start?.chapter && (
            <Select
              label="Current topic (optional)"
              value={String(start.topic ?? '')}
              disabled={topicLoading}
              onChange={handleTopic}
              options={[{ value: '', label: topicLoading ? 'Loading topics…' : 'Start from this chapter' }, ...topics.map((x) => ({ value: String(x.id), label: x.name }))]}
            />
          )}
        </div>
      )}
    </Card>
  )
}