'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const ADMIN_EMAIL = 'i.makkawi@waadacademy.edu.sa'

interface School {
  id: string
  name: string
  email: string
  role: string
  license_expiry: string | null
  created_at: string
}

export default function AdminPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager', days: '365' })
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.email !== ADMIN_EMAIL) {
        router.push('/dashboard')
        return
      }
      loadSchools()
    })
  }, [])

  async function loadSchools() {
    // Admin uses service key via API route
    const res = await fetch('/api/admin/schools')
    if (res.ok) {
      const data = await res.json()
      setSchools(data.schools || [])
    }
    setLoading(false)
  }

  async function createSchool(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setMsg('')
    const res = await fetch('/api/admin/create-school', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    if (res.ok) {
      setMsg('✅ تم إنشاء الحساب بنجاح')
      setForm({ name: '', email: '', password: '', role: 'manager', days: '365' })
      setShowForm(false)
      loadSchools()
    } else {
      setMsg('❌ ' + (data.error || 'خطأ'))
    }
    setCreating(false)
  }

  async function setLicense(schoolId: string, days: number) {
    const expiry = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
    await fetch('/api/admin/set-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId, expiry })
    })
    loadSchools()
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const s = {
    page: { minHeight: '100vh', background: 'var(--bg)', direction: 'rtl' as const },
    top: { background: 'var(--bg-2)', borderBottom: '1px solid var(--line)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 } as React.CSSProperties,
    logo: { width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#5b8cff,#7c5cff)', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#fff', fontSize: 15 } as React.CSSProperties,
    content: { padding: '28px 24px', maxWidth: 1000, margin: '0 auto' } as React.CSSProperties,
    card: { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, padding: 24, marginBottom: 20 } as React.CSSProperties,
    btn: { background: 'linear-gradient(135deg,#5b8cff,#7c5cff)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' } as React.CSSProperties,
    btn2: { background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' } as React.CSSProperties,
    input: { width: '100%', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const },
    label: { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--txt-dim)', marginBottom: 5 },
    badge: (ok: boolean) => ({ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: ok ? 'rgba(52,211,153,.15)' : 'rgba(248,113,113,.15)', color: ok ? '#34d399' : '#f87171' }),
    roleBadge: (r: string) => ({ fontSize: 11, padding: '3px 10px', borderRadius: 8, background: r === 'manager' ? 'rgba(91,140,255,.15)' : 'rgba(124,92,255,.15)', color: r === 'manager' ? '#5b8cff' : '#7c5cff' }),
    table: { width: '100%', borderCollapse: 'collapse' as const },
    th: { textAlign: 'right' as const, padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--txt-dim)', borderBottom: '1px solid var(--line)' },
    td: { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid var(--line)' },
    msg: { padding: '12px 16px', borderRadius: 10, marginBottom: 16, background: msg.includes('✅') ? 'rgba(52,211,153,.15)' : 'rgba(248,113,113,.15)', color: msg.includes('✅') ? '#34d399' : '#f87171', fontSize: 13 },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 } as React.CSSProperties,
  }

  if (loading) return (
    <div style={{ ...s.page, display: 'grid', placeItems: 'center' }}>
      <div style={{ color: 'var(--txt-dim)' }}>جارٍ التحميل...</div>
    </div>
  )

  return (
    <div style={s.page}>
      <header style={s.top}>
        <div style={s.logo}>R</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>راصد — لوحة الأدمن</div>
          <div style={{ fontSize: 11, color: 'var(--txt-dim)' }}>Ibrahim Makkawi</div>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10 }}>
          <button style={s.btn2} onClick={handleSignOut}>تسجيل خروج</button>
        </div>
      </header>

      <div style={s.content}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' as const }}>
          {[
            { label: 'إجمالي المدارس', value: schools.length },
            { label: 'مدراء', value: schools.filter(s => s.role === 'manager').length },
            { label: 'مشرفون', value: schools.filter(s => s.role === 'supervisor').length },
            { label: 'تراخيص نشطة', value: schools.filter(s => s.license_expiry && new Date(s.license_expiry) > new Date()).length },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: '18px 22px', minWidth: 140 }}>
              <div style={{ fontSize: 11, color: 'var(--txt-dim)', fontWeight: 700, marginBottom: 6 }}>{stat.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Create School */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showForm ? 20 : 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>إنشاء حساب جديد</h2>
            <button style={s.btn} onClick={() => setShowForm(!showForm)}>
              {showForm ? 'إلغاء' : '+ حساب جديد'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={createSchool}>
              {msg && <div style={s.msg}>{msg}</div>}
              <div style={s.grid}>
                <div>
                  <label style={s.label}>اسم المدرسة *</label>
                  <input style={s.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="مدرسة النموذج الدولية" />
                </div>
                <div>
                  <label style={s.label}>البريد الإلكتروني *</label>
                  <input style={s.input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="admin@school.sa" />
                </div>
                <div>
                  <label style={s.label}>كلمة المرور *</label>
                  <input style={s.input} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} placeholder="8 أحرف على الأقل" />
                </div>
                <div>
                  <label style={s.label}>الصلاحية</label>
                  <select style={{ ...s.input }} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option value="manager">مدير (رفع + تحليل)</option>
                    <option value="supervisor">مشرف (تحليل فقط)</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>مدة الترخيص</label>
                  <select style={{ ...s.input }} value={form.days} onChange={e => setForm({ ...form, days: e.target.value })}>
                    <option value="30">30 يوم</option>
                    <option value="90">90 يوم</option>
                    <option value="180">6 أشهر</option>
                    <option value="365">سنة</option>
                    <option value="730">سنتان</option>
                  </select>
                </div>
              </div>
              <button type="submit" style={{ ...s.btn, marginTop: 16, width: '100%' }} disabled={creating}>
                {creating ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
              </button>
            </form>
          )}
        </div>

        {/* Schools List */}
        <div style={s.card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>المدارس ({schools.length})</h2>
          {schools.length === 0 ? (
            <p style={{ color: 'var(--txt-dim)', fontSize: 14 }}>لا توجد مدارس بعد</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {['المدرسة', 'البريد', 'الصلاحية', 'الترخيص', 'تمديد', 'تاريخ الإنشاء'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schools.map(school => {
                  const expiry = school.license_expiry ? new Date(school.license_expiry) : null
                  const licenseOk = expiry ? expiry > new Date() : false
                  const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : 0
                  return (
                    <tr key={school.id}>
                      <td style={s.td}><strong>{school.name}</strong></td>
                      <td style={s.td}><span style={{ color: 'var(--txt-dim)', fontSize: 12 }}>{school.email}</span></td>
                      <td style={s.td}><span style={s.roleBadge(school.role)}>{school.role === 'manager' ? 'مدير' : 'مشرف'}</span></td>
                      <td style={s.td}>
                        <span style={s.badge(licenseOk)}>
                          {licenseOk ? `${daysLeft} يوم` : 'منتهي'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[30, 90, 365].map(d => (
                            <button key={d} style={s.btn2} onClick={() => setLicense(school.id, d)}>+{d}y</button>
                          ))}
                        </div>
                      </td>
                      <td style={s.td}><span style={{ color: 'var(--txt-dim)', fontSize: 11 }}>{new Date(school.created_at).toLocaleDateString('ar')}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
