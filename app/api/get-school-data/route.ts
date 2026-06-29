import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userClient = createClient(SUPA_URL, SUPA_KEY)
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(SUPA_URL, SVC_KEY)

    // Try user_profiles first
    const { data: profile } = await admin.from('user_profiles')
      .select('school_id, role').eq('id', user.id).single()

    let schoolId: string = profile?.school_id || ''
    let role: string     = profile?.role       || ''

    // Fallback: original system — schools.id = user.id (no user_profiles row needed)
    if (!schoolId) {
      const { data: schoolRow } = await admin.from('schools')
        .select('id, role').eq('id', user.id).single()
      if (schoolRow) {
        schoolId = user.id
        role     = schoolRow.role || 'manager'
      }
    }

    if (!schoolId) return NextResponse.json({ error: 'No school assigned' }, { status: 400 })

    const { data: school } = await admin.from('schools')
      .select('name, email, license_expiry').eq('id', schoolId).single()

    const { data: rec } = await admin.from('school_data')
      .select('rows, config, created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1).single()

    return NextResponse.json({
      rows:       rec?.rows   || [],
      config:     rec?.config || {},
      schoolName: school?.name           || '',
      schoolEmail:school?.email          || '',
      licenseExpiry: school?.license_expiry || '',
      role,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
