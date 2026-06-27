"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function SignupPage() {
  const [schoolName, setSchoolName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError("")
    const { data, error: authError } = await supabase.auth.signUp({
      email, password,
      options: { data: { school_name: schoolName } }
    })
    if (authError) { setError(authError.message); setLoading(false); return }
    if (data.user) {
      await supabase.from("schools").insert({
        id: data.user.id, name: schoolName, email,
        license_expiry: new Date(Date.now() + 30*24*60*60*1000).toISOString().split("T")[0]
      })
      if (data.session) { router.push("/dashboard"); return }
      setDone(true)
    }
    setLoading(false)
  }

  const s = {
    page: { minHeight:"100vh", background:"var(--bg)", display:"grid", placeItems:"center", padding:20 } as React.CSSProperties,
    box: { background:"var(--panel)", border:"1px solid var(--line)", borderRadius:20, padding:36, width:"100%", maxWidth:440 } as React.CSSProperties,
    logo: { width:52, height:52, borderRadius:14, background:"linear-gradient(135deg,#5b8cff,#7c5cff)", display:"grid", placeItems:"center", fontSize:20, fontWeight:800, color:"#fff", margin:"0 auto 16px" } as React.CSSProperties,
    label: { display:"block", fontSize:12, fontWeight:700, color:"var(--txt-dim)", marginBottom:6 },
    input: { width:"100%", background:"var(--bg)", border:"1px solid var(--line)", color:"var(--txt)", borderRadius:10, padding:"11px 14px", fontSize:14, outline:"none", marginBottom:14 } as React.CSSProperties,
    btn: { width:"100%", background:"linear-gradient(135deg,#5b8cff,#7c5cff)", color:"#fff", border:"none", borderRadius:10, padding:"12px", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:4 } as React.CSSProperties,
    err: { background:"rgba(248,113,113,.15)", border:"1px solid #f87171", color:"#f87171", borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:14 },
  }

  if (done) return (
    <div style={s.page}>
      <div style={{...s.box, textAlign:"center"}}>
        <div style={{fontSize:48, marginBottom:16}}>checkmark</div>
        <h2 style={{fontSize:20, fontWeight:700, marginBottom:8}}>تم التسجيل بنجاح!</h2>
        <p style={{color:"var(--txt-dim)", marginBottom:20}}>تفقد بريدك الإلكتروني لتفعيل الحساب</p>
        <Link href="/auth/login" style={{...s.btn, display:"block", textDecoration:"none", textAlign:"center"}}>
          انتقل لتسجيل الدخول
        </Link>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.box}>
        <div style={s.logo}>R</div>
        <h1 style={{textAlign:"center", fontSize:20, fontWeight:700, marginBottom:6}}>إنشاء حساب جديد</h1>
        <p style={{textAlign:"center", color:"var(--txt-dim)", fontSize:13, marginBottom:24}}>
          جرب المنصة مجانا لمدة 30 يوما
        </p>
        {error && <div style={s.err}>{error}</div>}
        <form onSubmit={handleSignup}>
          <label style={s.label}>اسم المدرسة</label>
          <input style={s.input} type="text" value={schoolName} onChange={e=>setSchoolName(e.target.value)} required placeholder="مدرسة النموذج الدولية" />
          <label style={s.label}>البريد الإلكتروني</label>
          <input style={s.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="admin@school.sa" />
          <label style={s.label}>كلمة المرور</label>
          <input style={s.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="8 أحرف على الأقل" minLength={8} />
          <button style={s.btn} disabled={loading}>{loading ? "جارٍ التسجيل..." : "إنشاء الحساب"}</button>
        </form>
        <p style={{textAlign:"center", marginTop:20, fontSize:13, color:"var(--txt-dim)"}}>
          لديك حساب?{" "}
          <Link href="/auth/login" style={{color:"var(--brand)"}}>تسجيل الدخول</Link>
        </p>
      </div>
    </div>
  )
}
