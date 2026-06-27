'use client'
import { useState, useRef } from 'react'
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

function parseGradesSheet(rows: Record<string, any>[]): Pick<ParsedData,'students'|'subjects'|'meta'> {
  const allKeys     = Object.keys(rows[0] || {})
  const subjectCols = allKeys.filter(k => /^.+-Q[1-4]$/i.test(k.trim()))
  if (!subjectCols.length) throw new Error('لم تُكتشف أعمدة المواد — تأكد من الصيغة: "Math-Q1"')
  const subjects     = Array.from(new Set(subjectCols.map(k => k.replace(/-Q[1-4]$/i,'').trim())))
  const uniqueGrades = Array.from(new Set(rows.map((r:any)=>String(r['Grade']||r['grade']||'').trim()).filter(Boolean)))
  const uniqueSem    = Array.from(new Set(rows.map((r:any)=>String(r['Semester']||r['semester']||'').trim()).filter(Boolean)))
  const students: StudentRecord[] = rows.map((r:any)=>{
    const name=String(r['Name']||r['name']||'').trim()
    const grade=String(r['Grade']||r['grade']||'').trim()
    const cls=String(r['Class']||r['class']||'').trim()
    const stage=String(r['Stage']||r['stage']||'').trim()
    const semester=String(r['Semester']||r['semester']||'').trim()
    const year=String(r['Academic Year']||r['academic_year']||'').trim()
    const school=String(r['School']||r['school']||'').trim()
    const grades: Record<string,Record<string,number>> = {}
    for (const subj of subjects) {
      grades[subj] = {}
      for (const q of ['Q1','Q2','Q3','Q4']) {
        const col=subjectCols.find(k=>k.replace(/-Q[1-4]$/i,'').trim()===subj&&k.endsWith(`-${q}`))
        if (col) { const v=r[col]; grades[subj][q]=(v===''||v==null)?NaN:Number(v) }
      }
    }
    return {name,grade,class:cls,stage,semester,year,school,grades}
  }).filter(s=>s.name)
  if (!students.length) throw new Error('لا يوجد طلاب — تأكد من عمود Name')
  return {students,subjects,meta:{semester:uniqueSem[0],year:rows[0]?.['Academic Year']||'',grades:uniqueGrades}}
}

function parseTeachersSheet(rows: Record<string,any>[]): TeacherRecord[] {
  if (!rows?.length) return []
  return rows.map((r:any)=>{
    const name=String(r['Teacher Name']||r['teacher_name']||'').trim()
    const subject=String(r['Subject']||r['subject']||'').trim()
    const year=String(r['Academic Year']||'').trim()
    const sections:string[]=[]
    for(let i=1;i<=10;i++){const v=String(r[`Section ${i}`]||'').trim();if(v)sections.push(v)}
    return {name,subject,sections,year}
  }).filter(t=>t.name&&t.subject)
}

function parseTargetsSheet(rows: Record<string,any>[]): TargetRecord[] {
  if (!rows?.length) return []
  return rows.map((r:any)=>({
    subject:String(r['Subject']||r['subject']||'').trim(),
    target:Number(r['Target (%)']||r['Target']||r['target']||80),
    year:String(r['Academic Year']||'').trim(),
  })).filter(t=>t.subject)
}

async function parseFile(f: File): Promise<ParsedData> {
  const XLSX = await import('xlsx')
  const buf  = await f.arrayBuffer()
  if (f.name.toLowerCase().endsWith('.csv')) {
    const wb=XLSX.read(buf,{type:'array',raw:false})
    const rows=XLSX.utils.sheet_to_json<Record<string,any>>(wb.Sheets[wb.SheetNames[0]],{defval:''})
    if (!rows.length) throw new Error('الملف فارغ')
    return {...parseGradesSheet(rows),teachers:[],targets:[]}
  }
  const wb=XLSX.read(buf,{type:'array'})
  const gradesKey  =wb.SheetNames.find(n=>/grade|student/i.test(n))||wb.SheetNames[0]
  const teachersKey=wb.SheetNames.find(n=>/teacher/i.test(n))
  const targetsKey =wb.SheetNames.find(n=>/target/i.test(n))
  const gradesRows =XLSX.utils.sheet_to_json<Record<string,any>>(wb.Sheets[gradesKey],{defval:''})
  if (!gradesRows.length) throw new Error('شيت الدرجات فارغة')
  const gradeData=parseGradesSheet(gradesRows)
  const teachers=teachersKey?parseTeachersSheet(XLSX.utils.sheet_to_json<Record<string,any>>(wb.Sheets[teachersKey],{defval:''})):[]
  const targets =targetsKey ?parseTargetsSheet( XLSX.utils.sheet_to_json<Record<string,any>>(wb.Sheets[targetsKey], {defval:''})):[]
  return {...gradeData,teachers,targets}
}

export default function UploadPage() {
  const [file,setFile]       = useState<File|null>(null)
  const [loading,setLoading] = useState(false)
  const [error,setError]     = useState('')
  const [success,setSuccess] = useState(false)
  const [parsed,setParsed]   = useState<ParsedData|null>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const router   = useRouter()
  const supabase = createClient()

  async function handleFile(f:File) {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)){setError('xlsx أو csv فقط');return}
    setFile(f);setError('');setParsed(null)
    try{setParsed(await parseFile(f))}catch(err:any){setError(err.message)}
  }

  async function handleUpload() {
    if (!file||!parsed) return
    setLoading(true);setError('')
    try {
      const {data:{user}}=await supabase.auth.getUser()
      if (!user){router.push('/auth/login');return}
      await supabase.from('school_data').delete().eq('school_id',user.id)
      const {error:dbErr}=await supabase.from('school_data').insert({
        school_id:user.id, file_name:file.name,
        headers:['name','grade','class','stage','semester','year',...parsed.subjects],
        rows:    parsed.students as any,
        config:  {format:'v2',subjects:parsed.subjects,meta:parsed.meta,risk:60,defaultTarget:80,teachers:parsed.teachers,targets:parsed.targets},
      })
      if (dbErr) throw new Error(dbErr.message)
      setSuccess(true)
      setTimeout(()=>router.push('/dashboard/analytics'),1500)
    }catch(err:any){setError(err.message)}
    finally{setLoading(false)}
  }

  const pg:React.CSSProperties={minHeight:'100vh',background:'var(--bg)',padding:'32px 20px',direction:'rtl'}
  const panel:React.CSSProperties={background:'var(--panel)',border:'1px solid var(--line)',borderRadius:16,padding:28,marginBottom:20}
  const errBox:React.CSSProperties={background:'rgba(248,113,113,.12)',border:'1px solid #f87171',color:'#f87171',borderRadius:10,padding:'12px 16px',fontSize:13,marginBottom:16}
  const btn:React.CSSProperties={background:'linear-gradient(135deg,#5b8cff,#7c5cff)',color:'#fff',border:'none',borderRadius:12,padding:'13px 32px',fontSize:15,fontWeight:700,cursor:'pointer',width:'100%',marginTop:16,fontFamily:'inherit'}
  const tag:React.CSSProperties={display:'inline-block',background:'var(--bg)',border:'1px solid var(--line)',borderRadius:6,padding:'2px 9px',fontSize:11,margin:'2px',color:'var(--txt-dim)'}
  const statBox:React.CSSProperties={background:'var(--bg)',borderRadius:10,padding:'14px 16px'}
  const dropStyle=(active:boolean):React.CSSProperties=>({border:`2px dashed ${active?'#5b8cff':'var(--line)'}`,borderRadius:14,padding:'40px 20px',textAlign:'center',cursor:'pointer',background:active?'rgba(91,140,255,.04)':'transparent',transition:'all .2s'})

  if (success) return (
    <div style={{...pg,display:'grid',placeItems:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:72,marginBottom:20}}>&#x2705;</div>
        <h2 style={{fontSize:22,fontWeight:800,marginBottom:8}}>تم رفع البيانات بنجاح!</h2>
        <p style={{color:'var(--txt-dim)'}}>جارس الانتقال...</p>
      </div>
    </div>
  )

  return (
    <div style={pg}>
      <div style={{maxWidth:780,margin:'0 auto'}}>
        <button style={{display:'inline-flex',alignItems:'center',gap:6,color:'var(--txt-dim)',fontSize:13,marginBottom:24,cursor:'pointer',background:'none',border:'none',padding:0,fontFamily:'inherit'}} onClick={()=>router.push('/dashboard')}>← العودة</button>
        <h1 style={{fontSize:24,fontWeight:800,marginBottom:4}}>رفع بيانات الطلاب</h1>
        <p style={{color:'var(--txt-dim)',fontSize:14,marginBottom:28}}>ملف Excel بـ 3 تابات: الدرجات + المعلمين + الأهداف</p>

        <div style={panel}>
          <h3 style={{fontSize:16,fontWeight:700,marginBottom:8}}>الخطوة 1 — تحميل القالب</h3>
          <a href="/rased_template_v2.xlsx" download="rased_template_v2.xlsx" style={{display:'inline-flex',alignItems:'center',gap:8,background:'var(--bg)',border:'1px solid var(--line)',color:'var(--txt)',borderRadius:10,padding:'10px 18px',fontSize:14,fontWeight:700,textDecoration:'none',marginBottom:12}}>
            &#x1F4E5; قالب راصد v2 (3 تابات)
          </a>
          <div style={{background:'var(--bg)',borderRadius:10,padding:'12px 16px',fontSize:12,color:'var(--txt-dim)',lineHeight:2}}>
            <div><strong style={{color:'var(--txt)'}}>Grades:</strong> School, Name, Grade, Class, Stage, Semester, Year, Math-Q1, Math-Q2...</div>
            <div><strong style={{color:'var(--txt)'}}>Teachers:</strong> Teacher Name, Subject, Section 1, Section 2...</div>
            <div><strong style={{color:'var(--txt)'}}>Targets:</strong> Subject, Target (%), Academic Year</div>
          </div>
        </div>

        <div style={panel}>
          <h3 style={{fontSize:16,fontWeight:700,marginBottom:12}}>الخطوة 2 — رفع الملف</h3>
          {error && <div style={errBox}>&#x26A0;&#xFE0F; {error}</div>}
          <div style={dropStyle(!!file)} onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f)}}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f)}} />
            {file?(
              <div>
                <div style={{fontSize:36,marginBottom:8}}>&#x1F4CA;</div>
                <p style={{fontWeight:700}}>{file.name}</p>
                <p style={{color:'var(--txt-dim)',fontSize:13}}>{(file.size/1024).toFixed(1)} KB</p>
              </div>
            ):(
              <div>
                <div style={{fontSize:48,marginBottom:12}}>&#x1F4C2;</div>
                <p style={{fontWeight:700,marginBottom:6}}>اسحب ملف هنا أو انقر</p>
                <p style={{color:'var(--txt-dim)',fontSize:13}}>xlsx - xls - csv</p>
              </div>
            )}
          </div>
        </div>

        {parsed && (
          <div style={panel}>
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:16}}>معاينة الملف</h3>
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
                <div>{parsed.teachers.map(t=><span key={t.name+t.subject} style={{...tag,color:'#34d399',borderColor:'#34d399'}}>{t.name} - {t.subject} ({t.sections.join(', ')})</span>)}</div>
              </div>
            )}
            {parsed.targets.length>0&&(
              <div style={{marginBottom:14}}>
                <p style={{fontSize:12,fontWeight:700,color:'var(--txt-dim)',marginBottom:6}}>الأهداف:</p>
                <div>{parsed.targets.map(t=><span key={t.subject} style={{...tag,color:'#fbbf24',borderColor:'#fbbf24'}}>{t.subject}: {t.target}%</span>)}</div>
              </div>
            )}
            <button style={btn} onClick={handleUpload} disabled={loading}>
              {loading?'جارس الرفع...':`رفع ${parsed.students.length} طالب وفتح التحليل`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
