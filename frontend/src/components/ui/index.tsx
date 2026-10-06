'use client'
import{useEffect,useMemo,useRef,useState}from'react';import styles from'./ui.module.css'
/** Shared Havan UI primitives. These components contain no business knowledge. */
export function Button({children,variant='primary',size='md',loading=false,fullWidth=false,disabled=false,type='button',onClick}:{children:React.ReactNode;
variant?:'primary'|'secondary'|'ghost'|'danger';
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
export function Card({children,as:Tag='div',padding='md',radius='md',className=''}:{children:React.ReactNode;as?:'div'|'section'|'article';padding?:'sm'|'md'|'lg';radius?:'sm'|'md'|'lg';className?:string}){
  return <Tag className={`${styles.card} ${styles[padding]} ${styles[radius]} ${className}`}>{children}</Tag>
}
export function Chip({children,tone='neutral'}:{children:React.ReactNode;tone?:'neutral'|'info'|'success'|'warn'|'danger'}){return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>}
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
export function EmptyState({icon='○',title,hint,action}:{icon?:string;
title:string;
hint:string;
action?:React.ReactNode}){return <section className={styles.empty}>
<div aria-hidden="true">
{icon}</div>
<h2>
{title}</h2>
<p>
{hint}</p>
{action}</section>}
export function ErrorState({onRetry,message='Something went wrong. Reload.'}:{onRetry:()=>
void;
message?:string}){return <section className={styles.error} role="alert">
<h2>
Something went wrong</h2>
<p>
{message}</p>
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
export function BottomSheet({open,title,children,onClose}:{open:boolean;
title:string;
children:React.ReactNode;
onClose:()=>
void}){const ref=useRef<HTMLDivElement>(null);
useEffect(()=>
{if(open)ref.current?.focus()},[open]);
if(!open)return null;
return <>
<div className={styles.backdrop} onClick={onClose}/>
<section className={styles.sheet} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
<header>
<h2 id="sheet-title">{title}</h2>
<button className={styles.close} type="button" aria-label="Close" onClick={onClose}>×</button>
</header>{children}</section>
</>
}
type Topic={id:string;name:string;minutes:number};type Chapter={id:string;name:string;topics:Topic[]};type Course={id:string;name:string;chapters:Chapter[]}
export function TreeSelect({courses,selected,onChange}:{courses:Course[];
selected:ReadonlySet<string>;
onChange:(s:Set<string>)=>
void}){const[open,setOpen]=useState<Set<string>>(new Set());
const total=useMemo(()=>
courses.flatMap(c=>
c.chapters.flatMap(x=>
x.topics)).filter(t=>
selected.has(t.id)).reduce((a,t)=>
a+t.minutes,0),[courses,selected]);
return <div className={styles.tree}>
<div className={styles.total}>{selected.size} topics · {total} min</div>{courses.map(c=>
<section key={c.id}>
<h3>{c.name}</h3>{c.chapters.map(ch=>{const o=open.has(ch.id);return <div className={styles.chapter} key={ch.id}>
<button type="button" onClick={()=>setOpen(p=>{const n=new Set(p);n.has(ch.id)?n.delete(ch.id):n.add(ch.id);return n})} aria-expanded={o}>{ch.name}</button>{o&&<div className={styles.topics}>{ch.topics.map(t=>
<label className={styles.topic} key={t.id}>
<input type="checkbox" checked={selected.has(t.id)} onChange={()=>{const n=new Set(selected);n.has(t.id)?n.delete(t.id):n.add(t.id);onChange(n)}}/>
<span>{t.name}<small>{t.minutes} min</small>
</span>
</label>)}</div>}</div>})}</section>)}</div>
}