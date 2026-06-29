'use client'
import React, { useState, CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface StudentRecord {
  name: string; grade: string; class: string
  stage: string; semester: string; year: string; school: string
  grades: Record<string, Record<string, number>>
}
interface TeacherRecord { name: string; subject: string; sections: string[]; year: string }
interface TargetRecord  { subject: string; target: number; year: string }
interface ParsedData {
  students: StudentRecord[]
  subjects: string[]
  teachers: TeacherRecord[]
  targets:  TargetRecord[]
  meta: { semester?: string; year?: string; grades: string[] }
}

// Strip BOM and normalize
function cleanText(t: string): string {
  return t.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = cleanText(text).trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals: string[] = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
      else cur += ch
    }
    vals.push(cur.trim())
    const row: Record<string,string> = {}
    headers.forEach((h,i) => row[h] = (vals[i]||'').replace(/^"|"$/g,''))
    return row
  }).filter(r => Object.values(r).some(v => v))
}

// Detect subject-quarter columns with multiple patterns:
// "Math-Q1", "Math Q1", "Math_Q1", "عربي-Q1"
function detectSubjectCols(keys: string[]): string[] {
  // Pattern 1: Subject-Q1 (standard)
  let cols = keys.filter(k => /^.+-Q[1-4]$/i.test(k.trim()))
  if (cols.length) return cols
  // Pattern 2: Subject Q1 (space separator)
  cols = keys.filter(k => /^.+\sQ[1-4]$/i.test(k.trim()))
  if (cols.length) return cols
  // Pattern 3: Subject_Q1 (underscore)
  cols = keys.filter(k => /^.+_Q[1-4]$/i.test(k.trim()))
  if (cols.length) return cols
  return []
}

// Normalize key to "Subject-Q1" form
function normKey(k: string): string {
  return k.trim().replace(/\s+Q([1-4])$/i, '-Q$1').replace(/_Q([1-4])$/i, '-Q$1')
}

function parseGradesSheet(rows: Record<string, any>[]): Pick<ParsedData,'students'|'subjects'|'meta'> {
  if (!rows.length) throw new Error('الشيت فارغ أو لم يتم تحميله — تأكد أن اسم التاب هو Grades وأن الشيت مشارك')
  const allKeys = Object.keys(rows[0] || {})
  const subjectCols = detectSubjectCols(allKeys)
  if (!subjectCols.length) {
    const sample = allKeys.slice(0,10).join(', ')
    throw new Error(`لم تجد أعمدة المواد. الأعمدة الموجودة: [${sample}]\nالشكل المطلوب: "اسم_المادة-Q1" مثال: "Arabic-Q1" أو "Math-Q1"`)
  }
  // Normalize col names to "Subject-Q1" format
  const normCols = subjectCols.map(normKey)
  const subjects = Array.from(new Set(normCols.map(k => k.replace(/-Q[1-4]$/i,'').trim())))
  const uniqueGrades = Array.from(new Set(rows.map((r:any)=>String(r['Grade']||r['grade']||'').trim()).filter(Boolean)))
  const uniqueSem    = Array.from(new Set(rows.map((r:any)=>String(r['Semester']||r['semester']||'').trim()).filter(Boolean)))
  const students: StudentRecord[] = rows.map((r:any)=>{
    const name=String(r['Name']||r['name']||'').trim()
    const grade=String(r['Grade']||r['grade']||'').trim()
    const cls=String(r['Class']||r['class']||'').trim()
    const stage=String(r['Stage']||r['stage']||'').trim()
    const semester=String(r['Semester']||r['semester']||'').trim()
    const year=String(r['Academic Year']||r['academic_year']||r['Year']||r['year']||'').trim()
    const school=String(r['School']||r['school']||'').trim()
    const grades: Record<string,Record<string,number>> = {}
    for (const subj of subjects) {
      grades[subj] = {}
      for (const q of ['Q1','Q2','Q3','Q4']) {
        // Try original key and normalized key
        const origCol = subjectCols.find(k => normKey(k) === `${subj}-${q}`)
        const col = origCol || null
        if (col) {
          const v = r[col]
          grades[subj][q] = (v===''||v==null) ? NaN : Number(v)
        }
      }
    }
    return {name,grade,class:cls,stage,semester,year,school,grades}
  }).filter(s=>s.name)
  if (!students.length) throw new Error('لا يوجد طلاب — تأكد من عمود Name')
  return {students,subjects,meta:{semester:uniqueSem[0],year:rows[0]?.['Academic Year']||rows[0]?.['year']||'',grades:uniqueGrades}}
}

function parseTeachersSheet(rows: Record<string,any>[]): TeacherRecord[] {
  if (!rows?.length) return []
  return rows.map((r:any)=>{
    const name=String(r['Teacher Name']||r['teacher_name']||r['Name']||r['name']||'').trim()
    const subject=String(r['Subject']||r['subject']||'').trim()
    const year=String(r['Academic Year']||r['year']||'').trim()
    const sections:string[]=[]
    for(let i=1;i<=15;i++){const v=String(r[`Section ${i}`]||r[`section_${i}`]||'').trim();if(v)sections.push(v)}
    return {name,subject,sections,year}
  }).filter(t=>t.name&&t.subject)
}

function parseTargetsSheet(rows: Record<string,any>[]): TargetRecord[] {
  if (!rows?.length) return []
  return rows.map((r:any)=>({
    subject:String(r['Subject']||r['subject']||'').trim(),
    target:Number(r['Target (%)']||r['Target']||r['target']||80),
    year:String(r['Academic Year']||r['year']||'').trim(),
  })).filter(t=>t.subject)
}

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

async function fetchSheetCSV(id: string, sheetName: string): Promise<Record<string,string>[]> {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
  try {
    const r = await fetch(url)
    if (!r.ok) return []
    const text = await r.text()
    if (text.includes('{"version"') || text.trim().length < 10) return []
    return parseCSV(text)
  } catch { return [] }
}

async function parseGoogleSheet(url: string): Promise<ParsedData> {
  const id = extractSheetId(url)
  if (!id) throw new Error('رابط Google Sheets غير صحيح')

  // Try multiple tab names for Grades
  let gradesRows: Record<string,string>[] = []
  for (const name of ['Grades','grades','GRADES','Scores','scores','الدرجات','النتائج']) {
    gradesRows = await fetchSheetCSV(id, name)
    if (gradesRows.length) break
  }

  const [teachersRows, targetsRows] = await Promise.all([
    (async () => {
      for (const n of ['Teachers','teachers','المعلمون','المعلمين']) {
        const r = await fetchSheetCSV(id, n); if (r.length) return r
      }
      return []
    })(),
    (async () => {
      for (const n of ['Targets','targets','الأهداف']) {
        const r = await fetchSheetCSV(id, n); if (r.length) return r
      }
      return []
    })(),
  ])

  if (!gradesRows.length) throw new Error('تأكد أن الشيت مشارك (Anyone with the link) وأن تاب Grades موجود')
  const gradeData = parseGradesSheet(gradesRows)
  const teachers  = parseTeachersSheet(teachersRows)
  const targets   = parseTargetsSheet(targetsRows)
  return {...gradeData, teachers, targets}
}

export default function UploadPage() {
  const [url,setUrl]           = useState('')
  const [loading,setLoading]   = useState(false)
  const [error,setError]       = useState('')
  const [success,setSuccess]   = useState(false)
  const [parsed,setParsed]     = useState<ParsedData|null>(null)
  const [fetching,setFetching] = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function handleFetch() {
    if (!url.trim()) return
    setFetching(true); setError(''); setParsed(null)
    try { setParsed(await parseGoogleSheet(url.trim())) }
    catch(e:any) { setError(e.message) }
    finally { setFetching(false) }
  }

  async function handleUpload() {
    if (!parsed) return
    setLoading(true); setError('')
    try {
      const {data:{user}}=await supabase.auth.getUser()
      if (!user){router.push('/auth/login');return}
      const {data:profile}=await supabase.from('user_profiles').select('school_id').eq('id',user.id).single()
      const schoolId=profile?.school_id
      if (!schoolId) throw new Error('لم يتم تعيين مدرسة لهذا الحساب')
      await supabase.from('school_data').delete().eq('school_id',schoolId)
      const {error:dbErr}=await supabase.from('school_data').insert({
        school_id:schoolId, file_name:'google_sheet',
        headers:['name','grade','class','stage','semester','year',...parsed.subjects],
        rows:    parsed.students as any,
        config:  {format:'v2',subjects:parsed.subjects,meta:parsed.meta,risk:60,defaultTarget:80,teachers:parsed.teachers,targets:parsed.targets,sheetUrl:url},
      })
      if (dbErr) throw new Error(dbErr.message)
      setSuccess(true)
      setTimeout(()=>router.push('/dashboard/analytics'),1500)
    }catch(e:any){setError(e.message)}
    finally{setLoading(false)}
  }

  const pg:CSSProperties={minHeight:'100vh',background:'var(--bg)',padding:'32px 20px',direction:'rtl'}
  const panel:CSSProperties={background:'var(--panel)',border:'1px solid var(--line)',borderRadius:16,padding:28,marginBottom:20}
  const errBox:CSSProperties={background:'rgba(248,113,113,.12)',border:'1px solid #f87171',color:'#f87171',borderRadius:10,padding:'12px 16px',fontSize:13,marginBottom:16,whiteSpace:'pre-wrap'}
  const btn:CSSProperties={background:'linear-gradient(135deg,#5b8cff,#7c5cff)',color:'#fff',border:'none',borderRadius:12,padding:'13px 32px',fontSize:15,fontWeight:700,cursor:'pointer',width:'100%',marginTop:16,fontFamily:'inherit'}
  const inp:CSSProperties={width:'100%',background:'var(--bg)',border:'1px solid var(--line)',borderRadius:10,padding:'12px 16px',fontSize:14,color:'var(--txt)',fontFamily:'inherit',boxSizing:'border-box',marginBottom:12}
  const tag:CSSProperties={display:'inline-block',background:'var(--bg)',border:'1px solid var(--line)',borderRadius:6,padding:'2px 9px',fontSize:11,margin:'2px',color:'var(--txt-dim)'}
  const statBox:CSSProperties={background:'var(--bg)',borderRadius:10,padding:'14px 16px'}

  if (success) return (
    <div style={{...pg,display:'grid',placeItems:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:72,marginBottom:20}}>&#x2705;</div>
        <h2 style={{fontSize:22,fontWeight:800,marginBottom:8}}>تم رفع البيانات بنجاح!</h2>
        <p style={{color:'var(--txt-dim)'}}>جارٍ الانتقال...</p>
      </div>
    </div>
  )

  return (
    <div style={pg}>
      <div style={{maxWidth:780,margin:'0 auto'}}>
        <button style={{display:'inline-flex',alignItems:'center',gap:6,color:'var(--txt-dim)',fontSize:13,marginBottom:24,cursor:'pointer',background:'none',border:'none',padding:0,fontFamily:'inherit'}} onClick={()=>router.push('/dashboard')}>← العودة</button>
        <h1 style={{fontSize:24,fontWeight:800,marginBottom:4}}>رفع بيانات الطلاب</h1>
        <p style={{color:'var(--txt-dim)',fontSize:14,marginBottom:28}}>ربط مع Google Sheets — الصق رابط الشيت أدناه</p>

        <div style={panel}>
          <h3 style={{fontSize:16,fontWeight:700,marginBottom:12}}>الخطوة 1 — جهّز Google Sheet</h3>
          <div style={{background:'var(--bg)',borderRadius:10,padding:'14px 16px',fontSize:13,color:'var(--txt-dim)',lineHeight:2.2}}>
            <div>📥 <strong style={{color:'var(--txt)'}}>تحميل القالب:</strong> <a href="/template.xlsx" download style={{color:'#5b8cff'}}>انقر هنا لتحميل قالب راصد (Excel)</a> ← ثم ارفعه لـ Google Sheets</div>
            <div>👁 <strong style={{color:'var(--txt)'}}>المشاركة:</strong> File → Share → Anyone with the link → Viewer</div>
            <div>📊 <strong style={{color:'var(--txt)'}}>التابات المطلوبة:</strong> <code style={{background:'rgba(91,140,255,.1)',padding:'1px 6px',borderRadius:4}}>Grades</code> + <code style={{background:'rgba(91,140,255,.1)',padding:'1px 6px',borderRadius:4}}>Teachers</code> + <code style={{background:'rgba(91,140,255,.1)',padding:'1px 6px',borderRadius:4}}>Targets</code></div>
            <div>📌 <strong style={{color:'var(--txt)'}}>تنسيق الدرجات:</strong> <code style={{background:'rgba(91,140,255,.1)',padding:'1px 6px',borderRadius:4}}>اسم_المادة-Q1</code> مثال: <code style={{background:'rgba(91,140,255,.1)',padding:'1px 6px',borderRadius:4}}>Arabic-Q1</code></div>
          </div>
        </div>

        <div style={panel}>
          <h3 style={{fontSize:16,fontWeight:700,marginBottom:12}}>الخطوة 2 — الصق رابط الشيت</h3>
          {error && <div style={errBox}>⚠️ {error}</div>}
          <input
            style={inp}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={url}
            onChange={e=>setUrl(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleFetch()}
          />
          <button style={{...btn,marginTop:0,opacity:fetching?0.7:1}} onClick={handleFetch} disabled={fetching||!url.trim()}>
            {fetching ? '⏳ جارٍ قراءة الشيت...' : '🔗 قراءة البيانات'}
          </button>
        </div>

        {parsed && (
          <div style={panel}>
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:16}}>معاينة البيانات ✅</h3>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
              <div style={statBox}><div style={{fontSize:11,color:'var(--txt-dim)',fontWeight:700,marginBottom:4}}>الطلاب</div><div style={{fontSize:26,fontWeight:800,color:'#5b8cff'}}>{parsed.students.length}</div></div>
              <div style={statBox}><div style={{fontSize:11,color:'var(--txt-dim)',fontWeight:700,marginBottom:4}}>المواد</div><div style={{fontSize:26,fontWeight:800,color:'#7c5cff'}}>{parsed.subjects.length}</div></div>
              <div style={statBox}><div style={{fontSize:11,color:'var(--txt-dim)',fontWeight:700,marginBottom:4}}>المعلمون</div><div style={{fontSize:26,fontWeight:800,color:'#34d399'}}>{parsed.teachers.length}</div></div>
              <div style={statBox}><div style={{fontSize:11,color:'var(--txt-dim)',fontWeight:700,marginBottom:4}}>الأهداف</div><div style={{fontSize:26,fontWeight:800,color:'#fbbf24'}}>{parsed.targets.length}</div></div>
            </div>
            <div style={{marginBottom:12}}>
              <p style={{fontSize:12,fontWeight:700,color:'var(--txt-dim)',marginBottom:6}}>المواد:</p>
              <div>{parsed.subjects.map(s=><span key={s} style={tag}>{s}</span>)}</div>
            </div>
            {parsed.teachers.length>0&&(
              <div style={{marginBottom:12}}>
                <p style={{fontSize:12,fontWeight:700,color:'var(--txt-dim)',marginBottom:6}}>المعلمون:</p>
                <div>{parsed.teachers.map(t=><span key={t.name+t.subject} style={{...tag,color:'#34d399',borderColor:'#34d399'}}>{t.name} — {t.subject}</span>)}</div>
              </div>
            )}
            {parsed.targets.length>0&&(
              <div style={{marginBottom:14}}>
                <p style={{fontSize:12,fontWeight:700,color:'var(--txt-dim)',marginBottom:6}}>الأهداف:</p>
                <div>{parsed.targets.map(t=><span key={t.subject} style={{...tag,color:'#fbbf24',borderColor:'#fbbf24'}}>{t.subject}: {t.target}%</span>)}</div>
              </div>
            )}
            <button style={btn} onClick={handleUpload} disabled={loading}>
              {loading ? 'جارٍ الحفظ...' : `حفظ ${parsed.students.length} طالب وفتح التحليل`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
