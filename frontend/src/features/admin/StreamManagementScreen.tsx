'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import styles from './admin.module.css'
type University = { id: number; name: string; code: string; status: string }
type Curriculum = { id: number; university_id: number; name: string; version: string; academic_year?: string | null; status: string }
type Stream = { id: number; curriculum_id: number; name: string; code: string; status: string }
type Course = { id: number; code: string; name: string; status: string }
type Mapping = { id: number; course_id: number; semester_number: number; status: string }
type Form = { name: string; code: string; curriculum_id: string }
export default function StreamManagementScreen() { const [universities, setUniversities] = useState<University[]>([]) const [curriculums, setCurriculums] = useState<Curriculum[]>([]) const [streams, setStreams] = useState<Stream[]>([])
const [universityId, setUniversityId] = useState('') const [curriculumId, setCurriculumId] = useState('') const [streamId, setStreamId] = useState('') const [search, setSearch] = useState('')
const [form, setForm] = useState<Form>({ name: '', code: '', curriculum_id: '' }) const [editing, setEditing] = useState<number | null>(null) const [editForm, setEditForm] = useState({ name: '', code: '' }) const [courses, setCourses] = useState<Course[]>([])
const [mappings, setMappings] = useState<Mapping[]>([]) const [busy, setBusy] = useState('') const [message, setMessage] = useState('') const [error, setError] = useState('') async function load() { try { setError('') const [u, c, s] = await Promise.all([
apiFetch<{ items: University[] }>('/universities?page=1&page_size=100'), apiFetch<{ items: Curriculum[] }>('/curriculums?page=1&page_size=100'), apiFetch<{ items: Stream[] }>('/streams?page=1&page_size=100'), ]) setUniversities(u.items) setCurriculums(c.items)
setStreams(s.items) const activeUniversity = u.items.find((item) => item.status === 'ACTIVE') const nextUniversity = universityId || (activeUniversity ? String(activeUniversity.id) : '') setUniversityId(nextUniversity) } catch (value) {
setError(value instanceof Error ? value.message : 'Could not load stream management data.') } } useEffect(() => { void load() }, []) const visibleCurriculums = useMemo( () => curriculums.filter((item) => String(item.university_id) === universityId),
[curriculums, universityId], ) const visibleStreams = useMemo(() => { const source = streams.filter((item) => String(item.curriculum_id) === curriculumId) const query = search.trim().toLowerCase() return query
? source.filter((item) => item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query)) : source }, [streams, curriculumId, search]) const selectedStream = streams.find((item) => String(item.id) === streamId)
const selectedCurriculum = curriculums.find((item) => String(item.id) === curriculumId) const activeCount = streams.filter((item) => String(item.curriculum_id) === curriculumId && item.status === 'ACTIVE').length useEffect(() => {
const first = visibleCurriculums.find((item) => item.status === 'ACTIVE') || visibleCurriculums[0] setCurriculumId(first ? String(first.id) : '') }, [universityId, curriculums]) useEffect(() => {
const first = streams.find((item) => String(item.curriculum_id) === curriculumId && item.status === 'ACTIVE') || streams.find((item) => String(item.curriculum_id) === curriculumId) setStreamId(first ? String(first.id) : '')
setForm((old) => ({ ...old, curriculum_id: first ? String(first.curriculum_id) : curriculumId })) }, [curriculumId, streams]) useEffect(() => { if (!streamId) { setCourses([]) setMappings([]) return } let cancelled = false Promise.all([
apiFetch<{ items: Course[] }>(`/courses?stream_id=${streamId}&page=1&page_size=100`), apiFetch<Mapping[]>(`/university-course-mappings?stream_id=${streamId}`), ]).then(([courseResult, mappingResult]) => { if (!cancelled) { setCourses(courseResult.items)
setMappings(mappingResult) } }).catch((value) => { if (!cancelled) setError(value instanceof Error ? value.message : 'Could not load stream dependencies.') }) return () => { cancelled = true } }, [streamId]) function selectUniversity(value: string) {
setUniversityId(value) setSearch('') } function selectCurriculum(value: string) { setCurriculumId(value) setForm((old) => ({ ...old, curriculum_id: value })) setSearch('') } async function addStream() {
if (!form.curriculum_id || !form.name.trim() || !form.code.trim()) return setBusy('add') setError('') setMessage('') try { await apiFetch('/streams', { method: 'POST', body: JSON.stringify({ curriculum_id: Number(form.curriculum_id), name: form.name.trim(),
code: form.code.trim().toUpperCase(), status: 'ACTIVE', }), }) setForm((old) => ({ ...old, name: '', code: '' })) setMessage('Stream added. It is now available to students only when its curriculum is active.') await load() } catch (value) {
setError(value instanceof Error ? value.message : 'Could not add stream.') } finally { setBusy('') } } function beginEdit(item: Stream) { setEditing(item.id) setEditForm({ name: item.name, code: item.code }) setError('') setMessage('') } async function saveEdit() {
if (!editing || !editForm.name.trim() || !editForm.code.trim()) return setBusy('edit-' + editing) setError('') setMessage('') try { await apiFetch('/streams/' + editing, { method: 'PATCH',
body: JSON.stringify({ name: editForm.name.trim(), code: editForm.code.trim().toUpperCase() }), }) setEditing(null) setMessage('Stream details updated without creating a new record.') await load() } catch (value) {
setError(value instanceof Error ? value.message : 'Could not update stream.') } finally { setBusy('') } } async function toggleStatus(item: Stream) { const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' if (!window.confirm( nextStatus === 'INACTIVE'
? 'Deactivate this stream? Existing courses and mappings stay intact, but students will no longer be able to select it.' : 'Activate this stream for student registration?', )) return setBusy('status-' + item.id) setError('') setMessage('') try {
await apiFetch('/streams/' + item.id, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }), }) setMessage(nextStatus === 'ACTIVE' ? 'Stream activated.' : 'Stream safely deactivated. Courses and mappings were preserved.') await load() } catch (value) {
setError(value instanceof Error ? value.message : 'Could not change stream status.') } finally { setBusy('') } } return ( <section> <header className={styles.header}> <span>SETUP · STREAM MANAGEMENT</span> <h1>Control the streams students can choose</h1>
<p>Streams connect an active curriculum to student registration and course mapping. Manage the stream record here; courses remain owned by the Course Registry and mappings remain a separate relationship.</p> </header>
{(message || error) && <div className={error ? styles.alert : styles.notice}>{error || message}</div>} <div className={styles.health}> <div> <span>Current path</span>
<b>{universities.find((item) => String(item.id) === universityId)?.code || '—'} → {selectedCurriculum ? `v${selectedCurriculum.version}` : '—'} → {selectedStream?.code || '—'}</b> </div>
<span>{activeCount} active stream{activeCount === 1 ? '' : 's'} in this curriculum</span> </div> <div className={styles.selectors}> <label>University <select value={universityId} onChange={(event) => selectUniversity(event.target.value)}>
<option value="">Choose university</option> {universities.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)} </select> </label> <label>Curriculum
<select value={curriculumId} onChange={(event) => selectCurriculum(event.target.value)}> <option value="">Choose curriculum</option> {visibleCurriculums.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)} </select> </label>
<label>Search streams <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Natural, Social, NAT…" /> </label> </div> <div className={styles.crudGrid}> <div className={styles.list}> <div className={styles.crudHead}> <div>
<h2>Streams in this curriculum</h2> <p>These records are exactly what active student registration exposes.</p> </div> <b>{visibleStreams.length}</b> </div> {!visibleStreams.length && <div className={styles.empty}>No streams match this curriculum and search.</div>}
{visibleStreams.map((item) => ( <div className={styles.row} key={item.id}> <div> <b>{item.code} · {item.name}</b> <small>{item.status} · Stream ID #{item.id}</small> </div>
<button onClick={() => setStreamId(String(item.id))}>{String(item.id) === streamId ? 'Selected' : 'Inspect'}</button> <div className={styles.actions}> <button onClick={() => beginEdit(item)}>Edit</button> <button
className={item.status === 'ACTIVE' ? styles.danger : styles.primary} disabled={busy === 'status-' + item.id} onClick={() => toggleStatus(item)} > {item.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} </button> </div> </div> ))} </div> <div className={styles.editor}>
<div> <h2>Add stream</h2> <p>Create one stable stream record under the selected curriculum. Do not create duplicate course records here.</p> </div> <label>Curriculum
<select value={form.curriculum_id || curriculumId} onChange={(event) => setForm((old) => ({ ...old, curriculum_id: event.target.value }))}> <option value="">Choose curriculum</option>
{curriculums.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)} </select> </label>
<label>Stream name<input value={form.name} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} placeholder="Natural Science" /></label>
<label>Stream code<input value={form.code} onChange={(event) => setForm((old) => ({ ...old, code: event.target.value }))} placeholder="NAT" /></label>
<button className={styles.primary} disabled={busy === 'add' || !form.curriculum_id || !form.name.trim() || !form.code.trim()} onClick={addStream}> {busy === 'add' ? 'Adding…' : 'Add stream'} </button> </div> </div> {editing !== null && ( <div className={styles.editor}>
<div className={styles.crudHead}> <div><h2>Edit stream</h2><p>Update the existing stream. Its courses and mappings stay attached to the same stream ID.</p></div> <button onClick={() => setEditing(null)}>Cancel</button> </div>
<label>Stream name<input value={editForm.name} onChange={(event) => setEditForm((old) => ({ ...old, name: event.target.value }))} /></label>
<label>Stream code<input value={editForm.code} onChange={(event) => setEditForm((old) => ({ ...old, code: event.target.value }))} /></label> <div className={styles.actions}>
<button className={styles.primary} disabled={busy === 'edit-' + editing} onClick={saveEdit}>{busy === 'edit-' + editing ? 'Saving…' : 'Save changes'}</button> </div> </div> )} <div className={styles.stats}>
<div><span>Selected stream courses</span><b>{courses.length}</b></div> <div><span>Active mappings</span><b>{mappings.filter((item) => item.status === 'ACTIVE').length}</b></div> <div><span>Selected stream status</span><b>{selectedStream?.status || '—'}</b></div>
<div><span>Curriculum ID</span><b>{selectedStream?.curriculum_id || '—'}</b></div> </div> <div className={styles.panel}> <h2>Dependency safety</h2> <div className={styles.indent}>
<span>Stream ID #{selectedStream?.id || '—'} is the stable relationship point used by course records and course mappings.</span> <span>Deactivation preserves courses and mappings so historical academic structure is not destroyed.</span>
<span>Students only receive active streams under an active curriculum during registration.</span> <span>Changing a stream name or code edits the existing record; it does not create another academic path.</span> </div> </div> </section> ) }
