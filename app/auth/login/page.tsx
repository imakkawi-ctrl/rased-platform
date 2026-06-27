'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('يرجى تأكيد بريدك الإلكتروني أولاً')
      } else {
        setError('البريد أو كلمة المرور غير صحيحة')
      }
      setLoading(false); return
    }
    router.push('/dashboard')
  }

  const s = {
    page: { minHeight:'100vh', background:'var(--bg)', display:'grid', placeItems:'center', padding:20 } as React.CSSProperties,
    box: { background:'var(--panel)', border:'1px solid var(--line)', borderRadius:20, padding:36, width:'100%', maxWidth:420 } as React.CSSProperties,
    logo: { width:52, height:52, borderRadius:14, background:'linear-gradient(135deg,#5b8cff,#7c5cff)', display:'grid', placeItems:'center', fontSize:20, fontWeight:800, color:'#fff', margin:'0 auto 16px' } as React.CSSProperties,
    title: { textAlign:'center' as const, fontSize:20, fontWeight:700, marginBottom:6 },
    sub: { textAlign:'center' as const, color:'var(--txt-dim)', fontSize:13, marginBottom:24 },
    label: { display:'block', fontSize:12, fontWeight:700, color:'var(--txt-dim)', marginBottom:6, letterSpacing:'.5px' },
    input: { width:'100%', background:'var(--bg)', border:'1px solid var(--line)', color:'var(--txt)', borderRadius:10, padding:'11px 14px', fontSize:14, outline:'none', marginBottom:14 } as React.CSSProperties,
    btn: { width:'100%', background:'linear-gradient(135deg,#5b8cff,#7c5cff)', color:'#fff', border:'none', borderRadius:10, padding:'12px', fontSize:15, fontWeight:700, cursor:'pointer', marginTop:4 } as React.CSSProperties,
    err: { background:'rgba(248,113,113,.15)', border:'1px solid #f87171', color:'#f87171', borderRadius:10, padding:'10px 14px', fontSize:13, marginBottom:14 },
  }

  return (
    <div style={s.page}>
      <div style={s.box}>
        <div style={s.logo}>R</div>
        <h1 style={s.title}>تسجيل الدخول</h1>
        <p style={s.sub}>أدخل بيانات حسابك للوصول إلى لوحة التحكم</p>
        {error && <div style={s.err}>{error}</div>}
        <form onSubmit={handleLogin}>
          <label style={s.label}>البريد الإلكتروني</label>
          <input style={s.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="school@example.com" />
          <label style={s.label}>كلمة المرور</label>
          <input style={s.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="password" />
          <button style={s.btn} disabled={loading}>{loading ? 'جارٍ الدخول...' : 'دخول'}</button>
        </form>
        <p style={{textAlign:'center', fontSize:13, color:'var(--txt-dim)', marginTop:20}}>
          ليس لديك حساب?{' '}
          <Link href="/auth/signup" style={{color:'var(--brand)'}}>سجّل مجاناً</Link>
        </p>
      </div>
    </div>
  )
}
