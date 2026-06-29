'use client'
import React, { useState, useEffect, CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface User {
  id: string; name: string; username: string; email: string
  role: string; role_label: string; is_banned: boolean
  last_login: string; created_at: string; is_self: boolean
}
interface SchoolInfo {
  schoolName: string; schoolEmail: string; licenseExpiry: string; role: string
  rows: any[]; config: any
}
const ROLES = [
  { value:'supervisor', label:'مشرف' },
  { value:'teacher',    label:'معلم' },
  { value:'viewer',     label:'مشاهد' },
]
const ROLE_COLORS: Record<string,string> = {
  manager:'#5b8cff', supervisor:'#7c5cff', teacher:'#34d399', viewer:'#fbbf24'
}

export default function SettingsPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [tok,    setTok]    = useState('')
  const [school, setSchool] = useState<SchoolInfo|null>(null)
  const [users,  setUsers]  = useState<User[]>([])
  const [loading,setLoading]= useState(true)
  const [error,  setError]  = useState('')

  // Add user form
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name:'', email:'', username:'', password:'', role:'supervisor' })
  const [addBusy, setAddBusy] = useState(false)
  const [addErr,  setAddErr]  = useState('')

  // Inline edit state: maps userId → { field: value }
  const [editRow,  setEditRow]  = useState<string>('')   // which row is open
  const [editPass, setEditPass] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      setTok(session.access_token)
      const at = session.access_token

      const [sRes, uRes] = await Promise.all([
        fetch('/api/get-school-data', { method:'POST', headers:{ Authorization:'Bearer '+at } }),
        fetch('/api/school/users',                    { headers:{ Authorization:'Bearer '+at } }),
      ])
      if (sRes.ok)  { setSchool(await sRes.json()) }
      else          { const e = await sRes.json(); throw new Error(e.error) }
      if (uRes.ok)  { const d = await uRes.json(); setUsers(d.users || []) }
      // non-managers get 403 on users endpoint — that's fine
    } catch(e:any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault(); setAddBusy(true); setAddErr('')
    try {
      const r = await fetch('/api/school/users', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+tok },
        body: JSON.stringify(addForm),
      })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error)
      setShowAdd(false); setAddForm({ name:'', email:'', username:'', password:'', role:'supervisor' })
      await reloadUsers()
    } catch(e:any) { setAddErr(e.message) }
    finally { setAddBusy(false) }
  }

  async function reloadUsers() {
    const r = await fetch('/api/school/users', { headers:{ Authorization:'Bearer '+tok } })
    if (r.ok) { const d = await r.json(); setUsers(d.users || []) }
  }

  async function saveEdit(userId: string) {
    setEditBusy(true)
    const payload: any = {}
    if (editPass) payload.password = editPass
    if (editRole) payload.role     = editRole
    const r = await fetch('/api/school/users/'+userId, {
      method:'PUT',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+tok },
      body: JSON.stringify(payload),
    })
    setEditBusy(false)
    if (r.ok) { setEditRow(''); setEditPass(''); setEditRole(''); await reloadUsers() }
    else { const e = await r.json(); alert(e.error) }
  }

  async function toggleBan(userId: string, isBanned: boolean) {
    const r = await fetch('/api/school/users/'+userId, {
      method:'PUT',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+tok },
      body: JSON.stringify({ banned: !isBanned }),
    })
    if (r.ok) await reloadUsers()
    else { const e = await r.json(); alert(e.error) }
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm('حذف ' + email + ' نهائياً؟')) return
    const r = await fetch('/api/school/users/'+userId, {
      method:'DELETE', headers:{ Authorization:'Bearer '+tok },
    })
    if (r.ok) setUsers(prev => prev.filter(u => u.id !== userId))
    else { const e = await r.json(); alert(e.error) }
  }

  // ── Styles ──
  const panel: CSSProperties = { background:'var(--panel)', border:'1px solid var(--line)', borderRadius:16, padding:24, marginBottom:20 }
  const inp:   CSSProperties = { background:'var(--bg)', border:'1px solid var(--line)', borderRadius:10, padding:'9px 13px', fontSize:13, color:'var(--txt)', fontFamily:'inherit', boxSizing:'border-box' as const, width:'100%' }
  const btn:   CSSProperties = { background:'linear-gradient(135deg,#5b8cff,#7c5cff)', color:'#fff', border:'none', borderRadius:10, padding:'9px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }
  const btnSm: CSSProperties = { background:'var(--panel)', border:'1px solid var(--line)', color:'var(--txt)', borderRadius:8, padding:'5px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }
  const errBox:CSSProperties = { background:'rgba(248,113,113,.12)', border:'1px solid #f87171', color:'#f87171', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 }
  const okBox: CSSProperties = { background:'rgba(52,211,153,.12)', border:'1px solid #34d399', color:'#34d399', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 }
  const th:    CSSProperties = { padding:'10px 12px', textAlign:'right' as const, color:'var(--txt-dim)', fontSize:11, fontWeight:700, whiteSpace:'nowrap' as const }
  const td:    CSSProperties = { padding:'10px 12px', borderTop:'1px solid var(--line)', fontSize:13, verticalAlign:'middle' as const }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'grid', placeItems:'center', color:'var(--txt-dim)' }}>
      ⏳ جارٍ التحميل...
    </div>
  )

  const isManager = school?.role === 'manager' || school?.role === 'admin'
  const sheetUrl  = school?.config?.sheetUrl || ''
  const lastSync  = school?.config?.lastSync ? new Date(school.config.lastSync).toLocaleString('ar-SA') : '—'
  const daysLeft  = school?.licenseExpiry ? Math.ceil((new Date(school.licenseExpiry).getTime() - Date.now()) / 86400000) : 0

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'28px 20px', direction:'rtl' }}>
      <div style={{ maxWidth:1000, margin:'0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
          <button style={btnSm} onClick={() => router.back()}>← العودة</button>
          <h1 style={{ fontSize:22, fontWeight:800 }}>إعدادات المدرسة</h1>
          <a href="/dashboard/analytics" style={{ marginRight:'auto', ...btnSm, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}>📊 لوحة التحليل</a>
        </div>

        {error && <div style={errBox}>⚠️ {error}</div>}

        {/* ── School Info ── */}
        <div style={panel}>
          <h2 style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>معلومات المدرسة</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
            {[
              { l:'اسم المدرسة',   v: school?.schoolName    || '—' },
              { l:'البريد الإلكتروني', v: school?.schoolEmail || '—' },
              { l:'الصلاحية',      v: isManager ? 'مدير المدرسة' : 'مشرف' },
              { l:'الرخصة',        v: daysLeft > 0 ? daysLeft + ' يوم متبقي' : 'منتهية',
                c: daysLeft > 30 ? '#34d399' : daysLeft > 0 ? '#fbbf24' : '#f87171' },
            ].map(item => (
              <div key={item.l} style={{ background:'var(--bg)', borderRadius:10, padding:'12px 16px' }}>
                <div style={{ fontSize:10, color:'var(--txt-dim)', fontWeight:700, marginBottom:4 }}>{item.l}</div>
                <div style={{ fontSize:14, fontWeight:700, color: (item as any).c || 'var(--txt)' }}>{item.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sheet Status ── */}
        <div style={panel}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <h2 style={{ fontSize:15, fontWeight:700 }}>ملف Google Sheets</h2>
            {isManager && (
              <a href="/dashboard/upload" style={{ ...btnSm, textDecoration:'none', marginRight:'auto', background:'var(--grad,linear-gradient(135deg,#5b8cff,#7c5cff))', color:'#fff', border:'none', fontWeight:700 }}>
                📤 {sheetUrl ? 'استبدال الشيت' : 'رفع شيت جديد'}
              </a>
            )}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 16px' }}>
              <div style={{ fontSize:10, color:'var(--txt-dim)', fontWeight:700, marginBottom:4 }}>الطلاب</div>
              <div style={{ fontSize:22, fontWeight:800, color:'#5b8cff' }}>{school?.rows?.length || 0}</div>
            </div>
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 16px' }}>
              <div style={{ fontSize:10, color:'var(--txt-dim)', fontWeight:700, marginBottom:4 }}>المواد</div>
              <div style={{ fontSize:22, fontWeight:800, color:'#7c5cff' }}>{school?.config?.subjects?.length || 0}</div>
            </div>
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 16px' }}>
              <div style={{ fontSize:10, color:'var(--txt-dim)', fontWeight:700, marginBottom:4 }}>آخر مزامنة</div>
              <div style={{ fontSize:12, fontWeight:600 }}>{lastSync}</div>
            </div>
          </div>
          {sheetUrl && (
            <div style={{ background:'var(--bg)', borderRadius:8, padding:'8px 12px', fontSize:11, color:'var(--txt-dim)', marginTop:10, direction:'ltr', textAlign:'left', wordBreak:'break-all' }}>
              🔗 {sheetUrl.slice(0,80)}{sheetUrl.length > 80 ? '…' : ''}
            </div>
          )}
        </div>

        {/* ── User Management ── */}
        {isManager && (
          <div style={panel}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <h2 style={{ fontSize:15, fontWeight:700 }}>إدارة المستخدمين</h2>
              <span style={{ background:'var(--bg)', borderRadius:6, padding:'2px 8px', fontSize:11, color:'var(--txt-dim)' }}>{users.length} مستخدم</span>
              <button style={{ ...btn, marginRight:'auto', padding:'7px 16px', fontSize:12 }} onClick={() => { setShowAdd(!showAdd); setAddErr('') }}>
                {showAdd ? '✕ إغلاق' : '+ إضافة مستخدم'}
              </button>
            </div>

            {/* Add form */}
            {showAdd && (
              <form onSubmit={createUser} style={{ background:'var(--bg)', borderRadius:12, padding:16, marginBottom:20, border:'1px solid var(--line)' }}>
                <h3 style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'var(--txt-dim)' }}>بيانات المستخدم الجديد</h3>
                {addErr && <div style={errBox}>{addErr}</div>}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:10, color:'var(--txt-dim)', marginBottom:4 }}>الاسم</div>
                    <input style={inp} placeholder="الاسم الكامل" value={addForm.name} onChange={e=>setAddForm(p=>({...p,name:e.target.value}))} />
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'var(--txt-dim)', marginBottom:4 }}>اسم المستخدم</div>
                    <input style={inp} placeholder="username" value={addForm.username} onChange={e=>setAddForm(p=>({...p,username:e.target.value}))} />
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'var(--txt-dim)', marginBottom:4 }}>الدور *</div>
                    <select style={{ ...inp }} value={addForm.role} onChange={e=>setAddForm(p=>({...p,role:e.target.value}))}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'var(--txt-dim)', marginBottom:4 }}>البريد الإلكتروني *</div>
                    <input style={inp} type="email" required placeholder="user@school.com" value={addForm.email} onChange={e=>setAddForm(p=>({...p,email:e.target.value}))} />
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'var(--txt-dim)', marginBottom:4 }}>كلمة المرور *</div>
                    <input style={inp} type="password" required minLength={6} placeholder="••••••••" value={addForm.password} onChange={e=>setAddForm(p=>({...p,password:e.target.value}))} />
                  </div>
                </div>
                <button type="submit" style={btn} disabled={addBusy}>
                  {addBusy ? '⏳ جارٍ الإنشاء...' : '✓ إنشاء الحساب'}
                </button>
              </form>
            )}

            {/* Users table */}
            {users.length === 0 ? (
              <div style={{ textAlign:'center', padding:24, color:'var(--txt-dim)', fontSize:14 }}>لا يوجد مستخدمون بعد — أضف مستخدماً للبدء</div>
            ) : (
              <div style={{ border:'1px solid var(--line)', borderRadius:12, overflow:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'var(--bg)' }}>
                      <th style={th}>الاسم</th>
                      <th style={th}>البريد الإلكتروني</th>
                      <th style={th}>اسم المستخدم</th>
                      <th style={th}>الدور</th>
                      <th style={th}>الحالة</th>
                      <th style={th}>آخر دخول</th>
                      <th style={{ ...th, textAlign:'center' as const }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <React.Fragment key={u.id}>
                        <tr style={{ background: u.is_banned ? 'rgba(248,113,113,.04)' : 'transparent' }}>
                          <td style={td}>
                            <span style={{ fontWeight:600 }}>{u.name || '—'}</span>
                            {u.is_self && <span style={{ fontSize:10, color:'#5b8cff', marginRight:6, fontWeight:700 }}>أنت</span>}
                          </td>
                          <td style={{ ...td, direction:'ltr', textAlign:'left' as const }}>{u.email}</td>
                          <td style={{ ...td, direction:'ltr', textAlign:'left' as const, color:'var(--txt-dim)' }}>{u.username || '—'}</td>
                          <td style={td}>
                            <span style={{ background: ROLE_COLORS[u.role]+'22', color: ROLE_COLORS[u.role], borderRadius:6, padding:'2px 8px', fontWeight:700, fontSize:11 }}>
                              {u.role_label}
                            </span>
                          </td>
                          <td style={td}>
                            <span style={{ background: u.is_banned ? 'rgba(248,113,113,.15)' : 'rgba(52,211,153,.15)', color: u.is_banned ? '#f87171' : '#34d399', borderRadius:6, padding:'2px 8px', fontWeight:700, fontSize:11 }}>
                              {u.is_banned ? 'موقوف' : 'نشط'}
                            </span>
                          </td>
                          <td style={{ ...td, color:'var(--txt-dim)' }}>
                            {u.last_login ? new Date(u.last_login).toLocaleDateString('ar-SA') : '—'}
                          </td>
                          <td style={{ ...td, textAlign:'center' as const }}>
                            {!u.is_self ? (
                              <div style={{ display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap' }}>
                                <button style={btnSm} onClick={() => { setEditRow(editRow===u.id?'':u.id); setEditPass(''); setEditRole(u.role) }}>
                                  {editRow===u.id ? '✕' : '✏️ تعديل'}
                                </button>
                                <button style={{ ...btnSm, color: u.is_banned ? '#34d399' : '#fbbf24', borderColor: u.is_banned ? '#34d399' : '#fbbf24' }}
                                  onClick={() => toggleBan(u.id, u.is_banned)}>
                                  {u.is_banned ? '✓ تفعيل' : '⏸ إيقاف'}
                                </button>
                                <button style={{ ...btnSm, color:'#f87171', borderColor:'#f87171' }}
                                  onClick={() => deleteUser(u.id, u.email)}>🗑</button>
                              </div>
                            ) : (
                              <span style={{ fontSize:11, color:'var(--txt-dim)' }}>—</span>
                            )}
                          </td>
                        </tr>
                        {editRow === u.id && (
                          <tr style={{ background:'var(--bg)' }}>
                            <td colSpan={7} style={{ padding:'12px 16px', borderTop:'1px solid var(--line)' }}>
                              <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
                                <div style={{ minWidth:140 }}>
                                  <div style={{ fontSize:10, color:'var(--txt-dim)', marginBottom:4 }}>كلمة مرور جديدة</div>
                                  <input style={{ ...inp, padding:'7px 11px', fontSize:12 }} type="password"
                                    placeholder="اتركها فارغة للإبقاء" value={editPass}
                                    onChange={e=>setEditPass(e.target.value)} />
                                </div>
                                <div style={{ minWidth:120 }}>
                                  <div style={{ fontSize:10, color:'var(--txt-dim)', marginBottom:4 }}>تغيير الدور</div>
                                  <select style={{ ...inp, padding:'7px 11px', fontSize:12 }} value={editRole}
                                    onChange={e=>setEditRole(e.target.value)}>
                                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                  </select>
                                </div>
                                <button style={{ ...btn, padding:'7px 16px', fontSize:12, alignSelf:'flex-end' }}
                                  onClick={() => saveEdit(u.id)} disabled={editBusy}>
                                  {editBusy ? '⏳...' : '✓ حفظ'}
                                </button>
                                <button style={{ ...btnSm, alignSelf:'flex-end' }} onClick={() => setEditRow('')}>إلغاء</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
