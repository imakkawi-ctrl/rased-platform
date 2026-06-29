import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify token
    const userClient = createClient(SUPA_URL, SUPA_KEY)
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // All reads via service role — bypasses RLS entirely
    const admin = createClient(SUPA_URL, SVC_KEY)

    const { data: profile } = await admin.from('user_profiles')
      .select('school_id, role').eq('id', user.id).single()

    if (!profile?.school_id) {
      return NextResponse.json({ error: 'No school assigned' }, { status: 400 })
    }

    const { data: school } = await admin.from('schools')
      .select('name').eq('id', profile.school_id).single()

    const { data: rec } = await admin.from('school_data')
      .select('rows, config, created_at')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
      .limit(1).single()

    return NextResponse.json({
      rows:       rec?.rows   || [],
      config:     rec?.config || {},
      schoolName: school?.name || '',
      role:       profile.role || '',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
