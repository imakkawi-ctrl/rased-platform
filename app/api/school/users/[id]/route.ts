import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ALLOWED_ROLES = ['supervisor','teacher','viewer']

async function getCtxAndVerify(token: string, targetId: string) {
  const uc = createClient(SUPA_URL, SUPA_KEY)
  const { data: { user } } = await uc.auth.getUser(token)
  if (!user) return null
  const admin = createClient(SUPA_URL, SVC_KEY)

  const { data: callerProfile } = await admin.from('user_profiles')
    .select('school_id, role').eq('id', user.id).single()
  let schoolId = callerProfile?.school_id || ''
  let callerRole = callerProfile?.role || ''
  if (!schoolId) {
    const { data: school } = await admin.from('schools').select('id, role').eq('id', user.id).single()
    if (school) { schoolId = user.id; callerRole = school.role || 'manager' }
  }
  if (!schoolId) return null
  if (callerRole !== 'manager' && callerRole !== 'admin') return null

  // Verify target belongs to this school (or is the manager themselves)
  const isSelf = targetId === user.id
  if (!isSelf) {
    const { data: targetProfile } = await admin.from('user_profiles')
      .select('school_id').eq('id', targetId).single()
    if (!targetProfile || targetProfile.school_id !== schoolId) return null
  }

  return { admin, userId: user.id, schoolId, isSelf }
}

// PUT — update user (password / name / username / role / ban)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const ctx = await getCtxAndVerify(token, params.id)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 403 })

    const { password, name, username, role, banned } = await req.json()

    // Auth updates (password, metadata)
    const authUpdate: any = {}
    if (password) authUpdate.password = password
    const meta: any = {}
    if (name     !== undefined) meta.name     = name
    if (username !== undefined) meta.username = username
    if (Object.keys(meta).length) authUpdate.user_metadata = meta
    if (banned === true)  authUpdate.ban_duration = '87600h' // 10 years
    if (banned === false) authUpdate.ban_duration = 'none'

    if (Object.keys(authUpdate).length) {
      const { error: authErr } = await ctx.admin.auth.admin.updateUserById(params.id, authUpdate)
      if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })
    }

    // Role update — can't promote to manager, can't change own role
    if (role !== undefined) {
      if (ctx.isSelf) return NextResponse.json({ error: 'لا يمكنك تغيير صلاحيتك الخاصة' }, { status: 400 })
      if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'الدور غير مسموح' }, { status: 400 })
      const { error: roleErr } = await ctx.admin.from('user_profiles')
        .update({ role }).eq('id', params.id)
      if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE — remove user (can't delete self)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const ctx = await getCtxAndVerify(token, params.id)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 403 })
    if (ctx.isSelf) return NextResponse.json({ error: 'لا يمكنك حذف حسابك الخاص' }, { status: 400 })

    const { error } = await ctx.admin.auth.admin.deleteUser(params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
