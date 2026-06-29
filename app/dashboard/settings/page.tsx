'use client'
import React, { useState, useEffect, CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Supervisor { id: string; email: string; name: string; role: string; created_at: string }
interface SchoolData { rows: any[]; config: any; schoolName: string; schoolEmail: string; licenseExpiry: string; role: string }

export default function SettingsPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [data,       setData]       = useState<SchoolData|null>(null)
  const [supervisors,setSupervisors]= useState<Supervisor[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [token,      setToken]      = useState('')

  // Supervisor form
  const [supForm,    setSupForm]    = useState({ name:'', email:'', password:'' })
  const [supLoading, setSupLoading] = useState(false)
  const [supError,   setSupError]   = useState('')
  const [supSuccess, setSupSuccess] = useState('')

  // Edit form
  const [editId,     setEditId]     = useState('')
  const [editPass,   setEditPass]   = useState('')
  const [editLoading,setEditLoading]= useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const tok = session.access_token
      setToken(tok)

      const [schoolRes, supRes] = await Promise.all([
        fetch('/api/get-school-data', { method:'POST', headers:{ Authorization:'Bearer '+tok } }),
        fetch('/api/school/supervisors', { headers:{ Authorization:'Bearer '+tok } }),
      ])

      if (!schoolRes.ok) {
        const e = await schoolRes.json()
        throw new Error(e.error || 'فشل تحميل بيانات المدرسة')
      }
      const schoolData = await schoolRes.json()
      setData(schoolData)

      if (supRes.ok) {
        const supData = await supRes.json()
        setSupervisors(supData.supervisors || [])
      }
    } catch(e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function addSupervisor(e: React.FormEvent) {
    e.preventDefault()
    setSupLoading(true); setSupError(''); setSupSuccess('')
    try {
      const res = await fetch('/api/school/supervisors', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
        body: JSON.stringify(supForm),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      setSupSuccess('تم إنشاء حساب المشرف بنجاح ✅')
      setSupForm({ name:'', email:'', password:'' })
      // Reload supervisors list
      const supRes = await fetch('/api/school/supervisors', { headers:{ Authorization:'Bearer '+token } })
      if (supRes.ok) { const d = await supRes.json(); setSupervisors(d.supervisors || []) }
    } catch(e: any) { setSupError(e.message) }
    finally { setSupLoading(false) }
  }

  async function deleteSupervisor(id: string, email: string) {
    if (!confirm('حذف المشرف ' + email + '؟')) return
    const res = await fetch('/api/school/supervisors/'+id, {
      method:'DELETE',
      headers:{ Authorization:'Bearer '+token },
    })
    if (res.ok) setSupervisors(prev => prev.filter(s => s.id !== id))
    else { const e = await res.json(); alert(e.error) }
  }

  async function resetPassword(id: string) {
    if (!editPass.trim()) return
    setEditLoading(true)
    const res = await fetch('/api/school/supervisors/'+id, {
      method:'PUT',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({ password: editPass }),
    })
    setEditLoading(false)
    if (res.ok) { setEditId(''); setEditPass(''); alert('تم تحديث كلمة المرور ✅') }
    else { const e = await res.json(); alert(e.error) }
  }

  const panel: CSSProperties = { background:'var(--panel)', border:'1px solid var(--line)', borderRadius:16, padding:24, marginBottom:20 }
  const inp:   CSSProperties = { width:'100%', background:'var(--bg)', border:'1px solid var(--line)', borderRadius:10, padding:'10px 14px', fontSize:14, color:'var(--txt)', fontFamily:'inherit', boxSizing:'border-box' }
  const btn:   CSSProperties = { background:'linear-gradient(135deg,#5b8cff,#7c5cff)', color:'#fff', border:'none', borderRadius:10, padding:'10px 22px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }
  const btnSm: CSSProperties = { background:'var(--panel2,#252d3f)', border:'1px solid var(--line)', color:'var(--txt)', borderRadius:8, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }
  const errBox:CSSProperties = { background:'rgba(248,113,113,.12)', border:'1px solid #f87171', color:'#f87171', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 }
  const okBox: CSSProperties = { background:'rgba(52,211,153,.12)', border:'1px solid #34d399', color:'#34d399', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'grid', placeItems:'center' }}>
      <div style={{ textAlign:'center', color:'var(--txt-dim)' }}>⏳ جارٍ التحميل...</div>
    </div>
  )

  const isManager = data?.role === 'manager' || data?.role === 'admin'
  const sheetUrl  = data?.config?.sheetUrl || ''
  const lastSync  = data?.config?.lastSync ? new Date(data.config.lastSync).toLocaleString('ar-SA') : '—'
  const daysLeft  = data?.licenseExpiry ? Math.ceil((new Date(data.licenseExpiry).getTime() - Date.now()) / 86400000) : 0

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'28px 20px', direction:'rtl' }}>
      <div style={{ maxWidth:800, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28 }}>
          <button style={{ ...btnSm, gap:6, display:'inline-flex', alignItems:'center' }}
            onClick={() => router.back()}>
            {'← العودة'}
          </button>
          <h1 style={{ fontSize:22, fontWeight:800 }}>إعدادات المدرسة</h1>
        </div>

        {error && <div style={errBox}>⚠️ {error}</div>}

        {/* School Info */}
        <div style={panel}>
          <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>معلومات المدرسة</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div>
              <div style={{ fontSize:11, color:'var(--txt-dim)', fontWeight:700, marginBottom:4 }}>اسم المدرسة</div>
              <div style={{ fontSize:16, fontWeight:800 }}>{data?.schoolName || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--txt-dim)', fontWeight:700, marginBottom:4 }}>البريد الإلكتروني</div>
              <div style={{ fontSize:14 }}>{data?.schoolEmail || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--txt-dim)', fontWeight:700, marginBottom:4 }}>صلاحية الحساب</div>
              <div style={{ fontSize:14, fontWeight:700, color: isManager ? '#5b8cff' : '#7c5cff' }}>
                {isManager ? 'مدير' : 'مشرف'}
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--txt-dim)', fontWeight:700, marginBottom:4 }}>الرخصة</div>
              <div style={{ fontSize:14, fontWeight:700, color: daysLeft > 30 ? '#34d399' : daysLeft > 0 ? '#fbbf24' : '#f87171' }}>
                {daysLeft > 0 ? daysLeft + ' يوم متبقي' : 'منتهية'}
              </div>
            </div>
          </div>
        </div>

        {/* Data Status */}
        <div style={panel}>
          <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>بيانات Google Sheets</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
            <div>
              <div style={{ fontSize:11, color:'var(--txt-dim)', fontWeight:700, marginBottom:4 }}>الطلاب المرفوعون</div>
              <div style={{ fontSize:22, fontWeight:800, color:'#5b8cff' }}>{data?.rows?.length || 0}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--txt-dim)', fontWeight:700, marginBottom:4 }}>آخر مزامنة</div>
              <div style={{ fontSize:14, fontWeight:600 }}>{lastSync}</div>
            </div>
          </div>
          {sheetUrl && (
            <div style={{ background:'var(--bg)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--txt-dim)', marginBottom:14, wordBreak:'break-all', direction:'ltr', textAlign:'left' }}>
              🔗 {sheetUrl.length > 60 ? sheetUrl.slice(0,60)+'…' : sheetUrl}
            </div>
          )}
          {isManager && (
            <a href="/dashboard/upload" style={{ ...btn, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:8, fontSize:13 }}>
              📤 {sheetUrl ? 'استبدال الشيت' : 'رفع شيت جديد'}
            </a>
          )}
        </div>

        {/* Supervisors — manager only */}
        {isManager && (
          <div style={panel}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>إدارة المشرفين</h2>

            {/* Add form */}
            <form onSubmit={addSupervisor} style={{ background:'var(--bg)', borderRadius:12, padding:16, marginBottom:20 }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14, color:'var(--txt-dim)' }}>+ إضافة مشرف جديد</h3>
              {supError   && <div style={errBox}>{supError}</div>}
              {supSuccess && <div style={okBox}>{supSuccess}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:11, color:'var(--txt-dim)', marginBottom:4 }}>الاسم (اختياري)</div>
                  <input style={inp} placeholder="اسم المشرف" value={supForm.name}
                    onChange={e=>setSupForm(p=>({...p,name:e.target.value}))} />
                </div>
                <div>
                  <div style={{ fontSize:11, color:'var(--txt-dim)', marginBottom:4 }}>البريد الإلكتروني *</div>
                  <input style={inp} type="email" placeholder="supervisor@school.com"
                    value={supForm.email} required
                    onChange={e=>setSupForm(p=>({...p,email:e.target.value}))} />
                </div>
                <div>
                  <div style={{ fontSize:11, color:'var(--txt-dim)', marginBottom:4 }}>كلمة المرور *</div>
                  <input style={inp} type="password" placeholder="••••••••"
                    value={supForm.password} required minLength={6}
                    onChange={e=>setSupForm(p=>({...p,password:e.target.value}))} />
                </div>
              </div>
              <button type="submit" style={btn} disabled={supLoading}>
                {supLoading ? '⏳ جارٍ الإنشاء...' : '+ إنشاء حساب مشرف'}
              </button>
            </form>

            {/* Supervisors list */}
            {supervisors.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px', color:'var(--txt-dim)', fontSize:14 }}>لا يوجد مشرفون بعد</div>
            ) : (
              <div style={{ border:'1px solid var(--line)', borderRadius:10, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'var(--bg)' }}>
                      <th style={{ padding:'10px 14px', textAlign:'right', color:'var(--txt-dim)', fontSize:11, fontWeight:700 }}>الاسم</th>
                      <th style={{ padding:'10px 14px', textAlign:'right', color:'var(--txt-dim)', fontSize:11, fontWeight:700 }}>البريد الإلكتروني</th>
                      <th style={{ padding:'10px 14px', textAlign:'right', color:'var(--txt-dim)', fontSize:11, fontWeight:700 }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supervisors.map(sup => (
                      <tr key={sup.id} style={{ borderTop:'1px solid var(--line)' }}>
                        <td style={{ padding:'10px 14px', fontWeight:600 }}>{sup.name || '—'}</td>
                        <td style={{ padding:'10px 14px', direction:'ltr', textAlign:'left' }}>{sup.email}</td>
                        <td style={{ padding:'10px 14px' }}>
                          {editId === sup.id ? (
                            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                              <input style={{ ...inp, width:140, padding:'6px 10px', fontSize:12 }} type="password"
                                placeholder="كلمة مرور جديدة" value={editPass}
                                onChange={e=>setEditPass(e.target.value)} />
                              <button style={{ ...btnSm, color:'#34d399', borderColor:'#34d399' }}
                                onClick={()=>resetPassword(sup.id)} disabled={editLoading}>حفظ</button>
                              <button style={btnSm} onClick={()=>{setEditId('');setEditPass('')}}>إلغاء</button>
                            </div>
                          ) : (
                            <div style={{ display:'flex', gap:6 }}>
                              <button style={btnSm} onClick={()=>{setEditId(sup.id);setEditPass('')}}>🔑 كلمة المرور</button>
                              <button style={{ ...btnSm, color:'#f87171', borderColor:'#f87171' }}
                                onClick={()=>deleteSupervisor(sup.id, sup.email)}>🗑 حذف</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
