import Link from 'next/link'

export default function Home() {
  return (
    <div style={{
      minHeight:'100vh', background:'var(--bg)',
      display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:'24px', padding:'20px'
    }}>
      <div style={{
        width:72, height:72, borderRadius:18,
        background:'linear-gradient(135deg,#5b8cff,#7c5cff)',
        display:'grid', placeItems:'center',
        fontSize:28, fontWeight:800, color:'#fff'
      }}>راصد</div>

      <h1 style={{fontSize:28, fontWeight:800, color:'var(--txt)', textAlign:'center'}}>
        منصة تحليل النتائج المدرسية
      </h1>
      <p style={{color:'var(--txt-dim)', textAlign:'center', maxWidth:480, lineHeight:1.7}}>
        حلّل نتائج طلابك بدقة واحترافية — لوحة تحكم ذكية وتقارير فورية لجميع المواد
      </p>

      <div style={{display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center'}}>
        <Link href="/auth/signup" style={{
          background:'linear-gradient(135deg,#5b8cff,#7c5cff)',
          color:'#fff', padding:'12px 28px', borderRadius:12,
          fontWeight:700, fontSize:15, textDecoration:'none'
        }}>ابدأ مجاناً</Link>
        <Link href="/auth/login" style={{
          background:'var(--panel)', border:'1px solid var(--line)',
          color:'var(--txt)', padding:'12px 28px', borderRadius:12,
          fontWeight:700, fontSize:15, textDecoration:'none'
        }}>تسجيل الدخول</Link>
      </div>

      <div style={{
        marginTop:20, display:'grid',
        gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',
        gap:14, maxWidth:700, width:'100%'
      }}>
        {[
          {e:'📊', t:'تحليل فوري', d:'نتائج آنية بمجرد إدخال الدرجات'},
          {e:'🔒', t:'بيانات آمنة', d:'كل مدرسة ترى بياناتها فقط'},
          {e:'📈', t:'استنتاجات ذكية', d:'تنبيهات تلقائية للطلاب في خطر'},
          {e:'🌐', t:'عربي وإنجليزي', d:'واجهة كاملة بالغتين'},
        ].map(f => (
          <div key={f.t} style={{
            background:'var(--panel)', border:'1px solid var(--line)',
            borderRadius:14, padding:'16px', textAlign:'center'
          }}>
            <div style={{fontSize:28, marginBottom:8}}>{f.e}</div>
            <div style={{fontWeight:700, marginBottom:4}}>{f.t}</div>
            <div style={{fontSize:12, color:'var(--txt-dim)'}}>{f.d}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
