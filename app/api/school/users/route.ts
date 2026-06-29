import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ROLE_LABELS: Record<string,string> = {
  manager:'مدير المدرسة', supervisor:'مشرف', teacher:'معلم', viewer:'مشاهد'
}
const ALLOWED_ROLES = ['supervisor','teacher','viewer']

async function getCtx(token: string) {
  const uc = createClient(SUPA_URL, SUPA_KEY)
  const { data: { user } } = await uc.auth.getUser(token)
  if (!user) return null
  const admin = createClient(SUPA_URL, SVC_KEY)
  const { data: profile } = await admin.from('user_profiles')
    .select('school_id, role').eq('id', user.id).single()
  let schoolId = profile?.school_id || ''
  let role     = profile?.role       || ''
  if (!schoolId) {
    const { data: school } = await admin.from('schools').select('id, role').eq('id', user.id).single()
    if (school) { schoolId = user.id; role = school.role || 'manager' }
  }
  return schoolId ? { userId: user.id, schoolId, role, admin } : null
}

// GET — list all users for this school (manager only)
export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const ctx = await getCtx(token)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (ctx.role !== 'manager' && ctx.role !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Get all profiles linked to this school
    const { data: profiles } = await ctx.admin.from('user_profiles')
      .select('id, role, created_at')
      .eq('school_id', ctx.schoolId)
      .order('created_at', { ascending: true })

    // Also include the manager themselves (may not have a user_profiles row)
    const profileIds = new Set((profiles || []).map((p: any) => p.id))
    if (!profileIds.has(ctx.userId)) {
      (profiles || []).unshift({ id: ctx.userId, role: 'manager', created_at: '' })
    }

    // Fetch auth details in one call
    const { data: { users: authUsers } } = await ctx.admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const authMap: Record<string, any> = {}
    authUsers.forEach((u: any) => { authMap[u.id] = u })

    const users = (profiles || []).map((p: any) => {
      const au = authMap[p.id] || {}
      return {
        id:           p.id,
        name:         au.user_metadata?.name     || '',
        username:     au.user_metadata?.username  || '',
        email:        au.email                   || '',
        role:         p.role                     || 'supervisor',
        role_label:   ROLE_LABELS[p.role]        || p.role,
        is_banned:    au.banned_until && new Date(au.banned_until) > new Date() ? true : false,
        last_login:   au.last_sign_in_at         || '',
        created_at:   p.created_at               || au.created_at || '',
        is_self:      p.id === ctx.userId,
      }
    })

    return NextResponse.json({ users })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — create new user (manager only)
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const ctx = await getCtx(token)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (ctx.role !== 'manager' && ctx.role !== 'admin')
      return NextResponse.json({ error: 'ليس لديك صلاحية إنشاء مستخدمين' }, { status: 403 })

    const { name, email, username, password, role } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 })
    if (!ALLOWED_ROLES.includes(role))
      return NextResponse.json({ error: 'الدور غير مسموح به' }, { status: 400 })

    // Create auth user
    const { data: authData, error: authErr } = await ctx.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || '', username: username || '' },
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })
    const newId = authData.user!.id

    // Link to school
    const { error: profileErr } = await ctx.admin.from('user_profiles').upsert(
      { id: newId, school_id: ctx.schoolId, role },
      { onConflict: 'id' }
    )
    if (profileErr) {
      await ctx.admin.auth.admin.deleteUser(newId)
      return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: newId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
