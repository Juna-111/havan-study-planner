'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'

export type EntityKey = 'courses' | 'chapters' | 'topics'

type Field = {
  key: string
  label: string
  type?: 'text' | 'number' | 'textarea'
}

type Config = {
  key: EntityKey
  label: string
  endpoint: string
  parentKey?: string
  fields: Field[]
  create?: boolean
}

export const entityConfigs: Config[] = [
  {
    key: 'chapters',
    label: 'Chapters',
    endpoint: '/chapters',
    parentKey: 'course_id',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'order_index', label: 'Order', type: 'number' },
      { key: 'important_points', label: 'Critical points', type: 'textarea' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'topics',
    label: 'Topics',
    endpoint: '/topics',
    parentKey: 'chapter_id',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'order_index', label: 'Order', type: 'number' },
      { key: 'estimated_study_minutes', label: 'Study minutes', type: 'number' },
      { key: 'difficulty', label: 'Difficulty 1–5', type: 'number' },
      { key: 'exam_importance', label: 'Exam importance 0–1', type: 'number' },
      { key: 'conceptual_importance', label: 'Conceptual importance 0–1', type: 'number' },
      { key: 'important_points', label: 'Critical points', type: 'textarea' },
      { key: 'status', label: 'Status' },
    ],
  },
]

export default function CrudList({
  config,
  parentId,
}: {
  config: Config
  parentId?: string
}) {
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [edit, setEdit] = useState<Record<string, unknown> | null | undefined>(
    undefined,
  )
  const [form, setForm] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    const query =
      parentId && config.parentKey
        ? `?${config.parentKey}=${parentId}&page=1&page_size=100`
        : '?page=1&page_size=100'

    apiFetch<{ items: Record<string, unknown>[] }>(config.endpoint + query)
      .then((result) => setItems(result.items))
      .catch((value) =>
        setError(
          value instanceof Error ? value.message : 'Could not load content.',
        ),
      )
  }

  useEffect(load, [parentId, config.endpoint])

  function start(item: Record<string, unknown> | null) {
    setEdit(item)
    setForm(
      Object.fromEntries(
        config.fields.map((field) => [
          field.key,
          String(item?.[field.key] ?? ''),
        ]),
      ),
    )
  }

  async function save() {
    setBusy(true)
    try {
      const body: Record<string, unknown> = { ...form }
      for (const field of config.fields) {
        if (field.type === 'number' && body[field.key] !== '') {
          body[field.key] = Number(body[field.key])
        }
      }

      const result = await apiFetch<Record<string, unknown>>(
        edit ? config.endpoint + '/' + String(edit.id) : config.endpoint,
        {
          method: edit ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...body,
            ...(parentId && config.parentKey
              ? { [config.parentKey]: Number(parentId) }
              : {}),
          }),
        },
      )

      setItems((items) =>
        edit
          ? items.map((item) => (item.id === result.id ? result : item))
          : [result, ...items],
      )
      setEdit(undefined)
    } catch (value) {
      setError(
        value instanceof Error ? value.message : 'Could not save content.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function archive(item: Record<string, unknown>) {
    if (!confirm('Deactivate this record? It remains in the catalog.')) return

    try {
      await apiFetch(config.endpoint + '/' + item.id, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'INACTIVE' }),
      })
      load()
    } catch (value) {
      setError(
        value instanceof Error ? value.message : 'Could not update record.',
      )
    }
  }

  return (
    <div className={styles.crud}>
      <div className={styles.crudHead}>
        <div>
          <h2>{config.label}</h2>
          <p>Edit reusable academic content. Deactivation does not delete content.</p>
        </div>
        {config.create !== false && (
          <button onClick={() => start(null)}>New</button>
        )}
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      <div className={styles.crudGrid}>
        <div className={styles.list}>
          {items.map((item) => (
            <article className={styles.row} key={String(item.id)}>
              <div>
                <b>{String(item.code || 'Record')}</b>
                <span>{String(item.name || '')}</span>
                <small>{String(item.status || '')}</small>
              </div>
              <button onClick={() => start(item)}>Edit</button>
              <button className={styles.danger} onClick={() => archive(item)}>
                Deactivate
              </button>
            </article>
          ))}
          {!items.length && (
            <p className={styles.empty}>No records in this scope.</p>
          )}
        </div>

        {edit !== undefined && (
          <div className={styles.editor}>
            <h3>{edit ? 'Edit record' : 'New record'}</h3>
            {config.fields.map((field) => (
              <label key={field.key}>
                {field.label}
                {field.type === 'textarea' ? (
                  <textarea
                    value={form[field.key] || ''}
                    onChange={(event) =>
                      setForm({ ...form, [field.key]: event.target.value })
                    }
                  />
                ) : (
                  <input
                    type={field.type || 'text'}
                    value={form[field.key] || ''}
                    onChange={(event) =>
                      setForm({ ...form, [field.key]: event.target.value })
                    }
                  />
                )}
              </label>
            ))}

            <div className={styles.actions}>
              <button onClick={() => setEdit(undefined)}>Cancel</button>
              <button className={styles.primary} disabled={busy} onClick={save}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
