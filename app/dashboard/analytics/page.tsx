'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AnalyticsPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      const params = new URLSearchParams({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
      window.location.href = `/nia-analytics.html#${params.toString()}`
    })
  }, [])

  return (
    <div style={{minHeight:'100vh', background:'var(--bg)', display:'grid', placeItems:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{
          width:48, height:48,
          border:'4px solid var(--line)',
          borderTopColor:'#5b8cff',
          borderRadius:'50%',
          animation:'spin 1s linear infinite',
          margin:'0 auto 16px'
        }}/>
        <p style={{color:'var(--txt-dim)', fontSize:15}}>Loading analytics dashboard…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
