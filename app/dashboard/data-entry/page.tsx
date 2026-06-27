'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const SUBJECTS = ['Arabic Language', 'Islamic Studies', 'Social Studies']
const GRADES = ['1','2','3','4','5','6','7','8','9','10','11','12']
const STAGES = ['ابتدائي','متوسط','ثانوي']

export default function DataEntryPage() {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name:'', grade:'1', class:'', stage:'ابتدائي',
    semester:'الفصل الأول', year: new Date().getFullYear().toString(),
  })

  const [scores, setScores] = useState<Record<string,{q1:string,q2:string,q3:string,q4:string}>>({
    'Arabic Language': {q1:'',q2:'',q3:'',q4:''},
    'Islamic Studies': {q1:'',q2:'',q3:'',q4:''},
    'Social Studies':  {q1:'',q2:'',q3:'',q4:''},
  })

  function gradeLetter(p:number){return p>=95?'A+':p>=90?'A':p>=85?'B+':p>=80?'B':p>=75?'C+':p>=70?'C':p>=60?'D':'F'}

  async function handleSave(e:React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)

    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { setError('غير مسجّل الدخول'); setSaving(false); return }

    const { data: student, error: sErr } = await supabase.from('students').insert({
      school_id: user.id, name: form.name, grade: form.grade,
      class: form.class, stage: form.stage,
      semester: form.semester, academic_year: form.year,
    }).select().single()

    if (sErr) { setError('خطأ في حفظ بيانات الطالب: ' + sErr.message); setSaving(false); return }

    const scoreRows = SUBJECTS.map(subj => {
      const sc = scores[subj]
      const vals = [sc.q1,sc.q2,sc.q3,sc.q4].map(v=>parseFloat(v)).filter(v=>!isNaN(v))
      const avg = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0
      return {
        student_id: student.id, school_id: user.id, subject: subj,
        score: avg, performance_grade: gradeLetter(avg),
        q1: parseFloat(sc.q1)||null, q2: parseFloat(sc.q2)||null,
        q3: parseFloat(sc.q3)||null, q4: parseFloat(sc.q4)||null,
      }
    }).filter(r => r.score > 0)

    if (scoreRows.length > 0) {
      const { error: scErr } = await supabase.from('scores').insert(scoreRows)
      if (scErr) { setError('خطأ في حفظ الدرجات: ' + scErr.message); setSaving(false); return }
    }

    setSaved(true); setSaving(false)
    setForm({name:'',grade:'1',class:'',stage:'ابتدائي',semester:'الفصل الأول',year:new Date().getFullYear().toString()})
    setScores({'Arabic Language':{q1:'',q2:'',q3:'',q4:''},'Islamic Studies':{q1:'',q2:'',q3:'',q4:''},'Social Studies':{q1:'',q2:'',q3:'',q4:''}})
  }

  const inp = { background:'var(--bg)', border:'1px solid var(--line)', color:'var(--txt)', borderRadius:9, padding:'8px 12px', fontSize:13, outline:'none', width:'100%' } as React.CSSProperties
  const lbl = { display:'block', fontSize:11, fontWeight:700, color:'var(--txt-dim)', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'.5px' }

  return (
    <div style={{minHeight:'100vh', background:'var(--bg)'}}>
      <header style={{background:'var(--bg-2)', borderBottom:'1px solid var(--line)', padding:'14px 24px', display:'flex', alignItems:'center', gap:12}}>
        <Link href="/dashboard" style={{color:'var(--txt-dim)', textDecoration:'none', fontSize:13}}>← لوحة التحكم</Link>
        <span style={{color:'var(--line)'}}>|</span>
        <span style={{fontWeight:700}}>إدخال درجات طالب</span>
      </header>

      <div style={{maxWidth:700, margin:'0 auto', padding:'28px 20px'}}>
        {saved && <div style={{background:'rgba(52,211,153,.15)', border:'1px solid var(--good)', color:'var(--good)', borderRadius:10, padding:'12px 16px', marginBottom:20}}>✅ تم حفظ بيانات الطالب بنجاح!</div>}
        {error && <div style={{background:'rgba(248,113,113,.15)', border:'1px solid var(--bad)', color:'var(--bad)', borderRadius:10, padding:'12px 16px', marginBottom:20}}>{error}</div>}

        <form onSubmit={handleSave}>
          {/* بيانات الطالب */}
          <div style={{background:'var(--panel)', border:'1px solid var(--line)', borderRadius:16, padding:20, marginBottom:16}}>
            <h3 style={{fontWeight:700, marginBottom:16, fontSize:15}}>👤 بيانات الطالب</h3>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div><label style={lbl}>اسم الطالب</label><input style={inp} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="محمد أحمد" /></div>
              <div><label style={lbl}>الفصل / الشعبة</label><input style={inp} value={form.class} onChange={e=>setForm({...form,class:e.target.value})} required placeholder="1أ" /></div>
              <div><label style={lbl}>الصف</label>
                <select style={inp} value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}>
                  {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div><label style={lbl}>المرحلة</label>
                <select style={inp} value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>
                  {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label style={lbl}>الفصل الدراسي</label>
                <select style={inp} value={form.semester} onChange={e=>setForm({...form,semester:e.target.value})}>
                  <option>الفصل الأول</option><option>الفصل الثاني</option><option>الفصل الثالث</option>
                </select>
              </div>
              <div><label style={lbl}>العام الدراسي</label><input style={inp} value={form.year} onChange={e=>setForm({...form,year:e.target.value})} placeholder="2025" /></div>
            </div>
          </div>

          {/* الدرجات */}
          {SUBJECTS.map(subj => (
            <div key={subj} style={{background:'var(--panel)', border:'1px solid var(--line)', borderRadius:16, padding:20, marginBottom:16}}>
              <h3 style={{fontWeight:700, marginBottom:16, fontSize:15}}>
                {subj==='Arabic Language'?'🗣 اللغة العربية':subj==='Islamic Studies'?'📖 الدراسات الإسلامية':'🌍 الدراسات الاجتماعية'}
              </h3>
              <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10}}>
                {(['q1','q2','q3','q4'] as const).map(q=>(
                  <div key={q}>
                    <label style={lbl}>{q==='q1'?'الاختبار 1':q==='q2'?'الاختبار 2':q==='q3'?'الاختبار 3':'الاختبار 4'}</label>
                    <input style={inp} type="number" min="0" max="100" step="0.5"
                      value={scores[subj][q]}
                      onChange={e=>setScores({...scores,[subj]:{...scores[subj],[q]:e.target.value}})}
                      placeholder="—" />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button type="submit" disabled={saving} style={{width:'100%', background:'linear-gradient(135deg,#5b8cff,#7c5cff)', color:'#fff', border:'none', borderRadius:12, padding:'14px', fontSize:16, fontWeight:700, cursor:'pointer'}}>
            {saving ? 'جارٍ الحفظ…' : '💾 حفظ بيانات الطالب'}
          </button>
        </form>
      </div>
    </div>
  )
}
