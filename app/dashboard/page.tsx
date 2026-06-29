import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"

const ADMIN_EMAIL = 'i.makkawi@waadacademy.edu.sa'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  if (user.email === ADMIN_EMAIL) redirect('/admin')

  const { data: school } = await supabase.from("schools").select("*").eq("id", user!.id).single()
  const { count: dataCount } = await supabase.from("school_data").select("*", { count: "exact", head: true }).eq("school_id", user!.id)

  const licenseExpiry = school?.license_expiry ? new Date(school.license_expiry) : null
  const daysLeft      = licenseExpiry ? Math.ceil((licenseExpiry.getTime() - Date.now()) / 86400000) : 0
  const licenseOk     = daysLeft > 0
  const hasData       = (dataCount ?? 0) > 0
  const isManager     = (school?.role || 'manager') === 'manager'

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", direction:"rtl" }}>
      <header style={{ background:"var(--bg-2)", borderBottom:"1px solid var(--line)", padding:"14px 24px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:38, height:38, borderRadius:10, background:"linear-gradient(135deg,#5b8cff,#7c5cff)", display:"grid", placeItems:"center", fontWeight:800, color:"#fff", fontSize:15 }}>R</div>
        <div>
          <div style={{ fontWeight:700, fontSize:15 }}>{school?.name || "مدرستي"}</div>
          <div style={{ fontSize:11, color:"var(--txt-dim)" }}>راصد · لوحة التحليل</div>
        </div>
        <div style={{ marginRight:"auto", display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:12, padding:"4px 12px", borderRadius:8, fontWeight:600, background: isManager ? "rgba(91,140,255,.12)" : "rgba(124,92,255,.12)", color: isManager ? "#5b8cff" : "#7c5cff" }}>
            {isManager ? 'مدير' : 'مشرف'}
          </span>
          {licenseOk
            ? <span style={{ fontSize:12, color:"#34d399", background:"rgba(52,211,153,.12)", padding:"4px 12px", borderRadius:8, fontWeight:600 }}>رخصة: {daysLeft} يوم</span>
            : <span style={{ fontSize:12, color:"#f87171", background:"rgba(248,113,113,.12)", padding:"4px 12px", borderRadius:8, fontWeight:600 }}>الرخصة منتهية</span>
          }
          <form action="/auth/signout" method="post">
            <button type="submit" style={{ background:"var(--panel)", border:"1px solid var(--line)", color:"var(--txt-dim)", padding:"6px 14px", borderRadius:8, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>خروج</button>
          </form>
        </div>
      </header>

      <div style={{ padding:"32px 28px", maxWidth:960, margin:"0 auto" }}>
        <h1 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>
          {"أهلاً، "}{school?.name || user!.email}
        </h1>
        <p style={{ color:"var(--txt-dim)", marginBottom:28, fontSize:14 }}>
          {isManager ? 'لديك صلاحية رفع البيانات وعرض التحليل وإدارة المشرفين' : 'لديك صلاحية عرض التحليل فقط'}
        </p>

        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:32 }}>
          <Link href="/dashboard/analytics"
            style={{ background:"linear-gradient(135deg,#5b8cff,#7c5cff)", color:"#fff", padding:"12px 24px", borderRadius:11, fontWeight:700, fontSize:14, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:8, opacity: hasData ? 1 : 0.6 }}>
            {"📊 فتح لوحة التحليل"}{!hasData ? " (لا توجد بيانات)" : ""}
          </Link>
          {isManager && (
            <Link href="/dashboard/upload"
              style={{ background:"var(--panel)", border:"1px solid var(--line)", color:"var(--txt)", padding:"12px 24px", borderRadius:11, fontWeight:700, fontSize:14, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:8 }}>
              📤 رفع البيانات
            </Link>
          )}
          <Link href="/dashboard/settings"
            style={{ background:"var(--panel)", border:"1px solid var(--line)", color:"var(--txt)", padding:"12px 24px", borderRadius:11, fontWeight:700, fontSize:14, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:8 }}>
            ⚙️ إعدادات المدرسة
          </Link>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:28 }}>
          <div style={{ background:"var(--panel)", border:"1px solid var(--line)", borderRadius:14, padding:"22px" }}>
            <div style={{ fontSize:11, color:"var(--txt-dim)", fontWeight:700, marginBottom:8 }}>حالة البيانات</div>
            {hasData
              ? <div style={{ fontSize:18, fontWeight:800, color:"#34d399" }}>{"✓ بيانات مرفوعة"}</div>
              : <div style={{ fontSize:16, fontWeight:700, color:"#fbbf24" }}>لا توجد بيانات</div>
            }
          </div>
          <div style={{ background:"var(--panel)", border:"1px solid var(--line)", borderRadius:14, padding:"22px" }}>
            <div style={{ fontSize:11, color:"var(--txt-dim)", fontWeight:700, marginBottom:8 }}>الرخصة</div>
            {licenseOk
              ? <div style={{ fontSize:18, fontWeight:800, color:"#34d399" }}>{daysLeft} يوم متبقي</div>
              : <div style={{ fontSize:16, fontWeight:700, color:"#f87171" }}>منتهية الصلاحية</div>
            }
          </div>
          <div style={{ background:"var(--panel)", border:"1px solid var(--line)", borderRadius:14, padding:"22px" }}>
            <div style={{ fontSize:11, color:"var(--txt-dim)", fontWeight:700, marginBottom:8 }}>الصلاحية</div>
            <div style={{ fontSize:14, fontWeight:800 }}>{isManager ? "مدير (رفع + تحليل + إدارة)" : "مشرف (تحليل فقط)"}</div>
            <div style={{ fontSize:11, color:"var(--txt-dim)", marginTop:4 }}>{user!.email}</div>
          </div>
        </div>

      </div>
    </div>
  )
}
