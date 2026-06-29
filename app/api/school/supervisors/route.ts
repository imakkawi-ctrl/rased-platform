import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function getSchoolId(token: string): Promise<{ userId: string; schoolId: string } | null> {
  const userClient = createClient(SUPA_URL, SUPA_KEY)
  const { data: { user } } = await userClient.auth.getUser(token)
  if (!user) return null
  const admin = createClient(SUPA_URL, SVC_KEY)
  const { data: profile } = await admin.from('user_profiles')
    .select('school_id, role').eq('id', user.id).single()
  let schoolId = profile?.school_id || ''
  if (!schoolId) {
    const { data: school } = await admin.from('schools').select('id').eq('id', user.id).single()
    if (school) schoolId = user.id
  }
  return schoolId ? { userId: user.id, schoolId } : null
}

// GET — list supervisors for this school
export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getSchoolId(token)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(SUPA_URL, SVC_KEY)
    const { data: profiles } = await admin.from('user_profiles')
      .select('id, role, created_at')
      .eq('school_id', ctx.schoolId)
      .eq('role', 'supervisor')
      .order('created_at', { ascending: true })

    const ids = (profiles || []).map(p => p.id)
    let emailMap: Record<string, string> = {}
    let nameMap:  Record<string, string> = {}

    if (ids.length > 0) {
      // Fetch emails via admin auth list (paginated, max 1000)
      const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      users.forEach(u => {
        emailMap[u.id] = u.email || ''
        nameMap[u.id]  = (u.user_metadata?.name as string) || ''
      })
    }

    const result = (profiles || []).map(p => ({
      id:    p.id,
      email: emailMap[p.id] || '',
      name:  nameMap[p.id]  || '',
      role:  p.role,
      created_at: p.created_at,
    }))

    return NextResponse.json({ supervisors: result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — create new supervisor
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getSchoolId(token)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 })

    const admin = createClient(SUPA_URL, SVC_KEY)

    // Create auth user
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || '' },
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

    const supId = authData.user?.id!

    // Link to school via user_profiles
    const { error: profileErr } = await admin.from('user_profiles').upsert({
      id: supId,
      school_id: ctx.schoolId,
      role: 'supervisor',
    }, { onConflict: 'id' })

    if (profileErr) {
      await admin.auth.admin.deleteUser(supId)
      return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: supId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
