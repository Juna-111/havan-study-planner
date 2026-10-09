'use client'
import{useEffect,useMemo,useRef,useState}from'react';import styles from'./ui.module.css'
import { getStatusMeta } from '@/lib/status'
/** Shared Havan UI primitives. These components contain no business knowledge. */
export function Button({children,variant='primary',size='md',loading=false,fullWidth=false,disabled=false,type='button',onClick}:{children:React.ReactNode;
variant?:'primary'|'secondary'|'ghost'|'danger'|'accent';
size?:'md'|'lg';
loading?:boolean;
fullWidth?:boolean;
disabled?:boolean;
type?:'button'|'submit'|'reset';
onClick?:()=>
void}){
  return <button className={`${styles.button} ${styles[variant]} ${size==='lg'?styles.lg:''} ${fullWidth?styles.full:''}`} disabled={disabled||loading} type={type} onClick={onClick} aria-busy={loading||undefined}>
{loading&&<span className={styles.spinner} aria-hidden="true"/>}{children}</button>
}
export function IconButton({children,'aria-label':label,onClick,disabled=false}:{children:React.ReactNode;
'aria-label':string;
onClick?:()=>
void;
disabled?:boolean}){return <button className={styles.iconButton} aria-label={label} onClick={onClick} disabled={disabled} type="button">
{children}</button>}
export function Card({children,as:Tag='div',padding='md',radius='md',className='',style}:{children:React.ReactNode;as?:'div'|'section'|'article';padding?:'sm'|'md'|'lg';radius?:'sm'|'md'|'lg';className?:string;style?:React.CSSProperties}){
  return <Tag className={`${styles.card} ${styles[padding]} ${styles[radius]} ${className}`} style={style}>{children}</Tag>
}
export function Chip({children,tone='neutral'}:{children:React.ReactNode;tone?:'neutral'|'info'|'success'|'warn'|'danger'}){return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>}
export function StatusBadge({status}:{status:unknown}){
  const { label, tone, ariaLabel } = getStatusMeta(status)
  return <span className={`${styles.chip} ${styles[tone]}`} aria-label={ariaLabel}>{label}</span>
}
export function Segmented<T extends string>({options,value,onChange}:{options:readonly T[];value:T;onChange:(v:T)=>void}){
  return <div className={styles.group} role="group">{options.map(o=><button key={o} className={o===value?styles.active:styles.seg} aria-pressed={o===value} type="button" onClick={()=>onChange(o)}>{o}</button>)}</div>
}
export function Select({label,value,onChange,options,id,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];id?:string;disabled?:boolean}){
  return <label className={styles.field}>{label}<select id={id} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
}
export function DateField({label,value,onChange,min,max}:{label:string;
value:string;
onChange:(v:string)=>
void;
min?:string;
max?:string}){return <label className={styles.field}>
{label}<input type="date" value={value} min={min} max={max} onChange={e=>
onChange(e.target.value)}/>
</label>}
export function NumberStepper({label,value,onChange,min=0,max=24,step=1}:{label:string;value:number;onChange:(v:number)=>void;min?:number;max?:number;step?:number}){
  return <div className={styles.step}>
<span>{label}</span>
<span>
<button aria-label={`Decrease ${label}`} disabled={value<=min} type="button" onClick={()=>
onChange(Math.max(min,value-step))}>−</button> {value} <button aria-label={`Increase ${label}`} disabled={value>=max} type="button" onClick={()=>
onChange(Math.min(max,value+step))}>+</button>
</span>
</div>
}
export function Checkbox({label,checked,onChange,disabled=false}:{label:React.ReactNode;checked:boolean;onChange:(v:boolean)=>void;disabled?:boolean}){
  return <label className={styles.check}><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/>{label}</label>
}
export function ProgressBar({value,label='Progress'}:{value:number;label?:string}){const v=Math.max(0,Math.min(100,value));return <div className={styles.bar} aria-label={`${label}: ${Math.round(v)}%`}>
<div className={styles.track}>
<div className={styles.fill} style={{width:`${v}%`}}/>
</div>
<span>{Math.round(v)}%</span>
</div>
}
export function ProgressRing({value,label='Progress'}:{value:number;
label?:string}){const v=Math.max(0,Math.min(100,value));
return <div className={styles.ring} style={{'--degree':`${v*3.6}deg`} as React.CSSProperties} aria-label={`${label}: ${Math.round(v)}%`}>
<strong>
{Math.round(v)}%</strong>
</div>
}
export function Banner({tone='info',message,action}:{tone?:'info'|'warn'|'danger';
message:string;
action?:React.ReactNode}){return <div className={`${styles.banner} ${styles[tone]}`} role={tone==='danger'?'alert':'status'}>
<span aria-hidden="true">●</span>
<span>
{message}</span>
{action}</div>}
export function Skeleton({width='100%',height=20}:{width?:string;height?:number}){return <span className={styles.skeleton} style={{width,height}} aria-hidden="true"/>}
export function EmptyState({illustration,title,hint,action}:{illustration?:React.ReactNode;
title:string;
hint:string;
action?:React.ReactNode}){return <section className={styles.empty}>
{illustration ? (
  <div className="havan-empty-illustration-wrap" aria-hidden="true" style={{width:120,height:120,margin:'0 auto 8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
    {illustration}
  </div>
) : (
  <div aria-hidden="true" style={{fontSize:64,lineHeight:1,color:'var(--color-primary)',fontFamily:'var(--font-display)',fontWeight:900,marginBottom:4}}>
    H
  </div>
)}
<h2>
{title}</h2>
<p>
{hint}</p>
{action}</section>}
export function ErrorState({onRetry,message='Please try again in a moment.'}:{onRetry:()=>
void;
message?:string}){return <section className={styles.error} role="alert">
<h2>
Something interrupted your study flow</h2>
<p>
{message || 'We hit a temporary issue while loading your Havan dashboard. Please try again in a moment.'}</p>
<Button variant="secondary" onClick={onRetry}>
Try again</Button>
</section>}
export function Toast({message,onDismiss}:{message:string;
onDismiss:()=>
void}){useEffect(()=>
{const id=window.setTimeout(onDismiss,2500);
return()=>
window.clearTimeout(id)},[onDismiss]);
return <div className={styles.toast} role="status" aria-live="polite">
{message}</div>}
export function BottomSheet({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const node = ref.current
    node?.focus()
    const previous = document.activeElement as HTMLElement | null

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !node) return

      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button,a,input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (item) =>
          !item.hasAttribute('disabled') &&
          item.getAttribute('aria-hidden') !== 'true',
      )
      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <section
        className={styles.sheet}
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <header>
          <h2 id="sheet-title">{title}</h2>
          <button
            className={styles.close}
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </>
  )
}

type Topic = { id: string; name: string; minutes: number }
type Chapter = { id: string; name: string; topics: Topic[] }
type Course = { id: string; name: string; chapters: Chapter[] }

export function TreeSelect({
  courses,
  selected,
  onChange,
}: {
  courses: Course[]
  selected: ReadonlySet<string>
  onChange: (selection: Set<string>) => void
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const knownChapterIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    const available = new Set(
      courses.flatMap((course) =>
        course.chapters.map((chapter) => chapter.id),
      ),
    )
    const newChapterIds = [...available].filter((id) => !knownChapterIds.current.has(id))
    if (!newChapterIds.length) return
    knownChapterIds.current = available
    setOpen((previous) => new Set([...previous, ...newChapterIds]))
  }, [courses])
  const total = useMemo(
    () =>
      courses
        .flatMap((course) => course.chapters.flatMap((chapter) => chapter.topics))
        .filter((topic) => selected.has(topic.id))
        .reduce((sum, topic) => sum + topic.minutes, 0),
    [courses, selected],
  )

  return (
    <div className={styles.tree}>
      <div className={styles.total} role="status" aria-live="polite">
        {selected.size} topics · {total} min selected
      </div>
      {courses.map((course) => (
        <section className={styles.treeCourse} key={course.id}>
          <div className={styles.courseHeading}>
            <span>COURSE</span>
            <h3>{course.name}</h3>
          </div>
          {course.chapters.map((chapter) => {
            const isOpen = open.has(chapter.id)
            return (
              <div className={styles.chapter} key={chapter.id}>
                <button
                  className={styles.chapterButton}
                  type="button"
                  onClick={() =>
                    setOpen((previous) => {
                      const next = new Set(previous)
                      if (next.has(chapter.id)) next.delete(chapter.id)
                      else next.add(chapter.id)
                      return next
                    })
                  }
                  aria-expanded={isOpen}
                >
                  <span>{chapter.name}</span>
                  <small>{chapter.topics.length} {chapter.topics.length === 1 ? 'topic' : 'topics'}</small>
                </button>
                {isOpen && (
                  <div
                    className={styles.topics}
                    role="group"
                    aria-label={`Topics in ${chapter.name}`}
                  >
                    {chapter.topics.length > 1 && (
                      <button
                        className={styles.selectAllTopics}
                        type="button"
                        onClick={() => {
                          const next = new Set(selected)
                          const allSelected = chapter.topics.every((topic) => selected.has(topic.id))
                          chapter.topics.forEach((topic) => {
                            if (allSelected) next.delete(topic.id)
                            else next.add(topic.id)
                          })
                          onChange(next)
                        }}
                      >
                        {chapter.topics.every((topic) => selected.has(topic.id)) ? 'Clear chapter' : 'Select all topics'}
                      </button>
                    )}
                    {chapter.topics.length ? chapter.topics.map((topic) => (
                        <label className={styles.topic} key={topic.id}>
                          <input
                            type="checkbox"
                            checked={selected.has(topic.id)}
                            onChange={() => {
                              const next = new Set(selected)
                              if (next.has(topic.id)) next.delete(topic.id)
                              else next.add(topic.id)
                              onChange(next)
                            }}
                          />
                          <span>
                            {topic.name}
                            <small>{topic.minutes} min</small>
                          </span>
                        </label>
                      )) : (
                        <p className={styles.emptyTopics}>No active topics have been added to this chapter yet.</p>
                      )}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
