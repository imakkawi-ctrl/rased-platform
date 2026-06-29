import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function verifyManager(token: string, supId: string) {
  const userClient = createClient(SUPA_URL, SUPA_KEY)
  const { data: { user } } = await userClient.auth.getUser(token)
  if (!user) return null
  const admin = createClient(SUPA_URL, SVC_KEY)

  // Get manager's school_id
  const { data: profile } = await admin.from('user_profiles')
    .select('school_id').eq('id', user.id).single()
  let schoolId = profile?.school_id || user.id

  // Verify supervisor belongs to this school
  const { data: supProfile } = await admin.from('user_profiles')
    .select('school_id, role').eq('id', supId).single()
  if (!supProfile || supProfile.school_id !== schoolId || supProfile.role !== 'supervisor') return null

  return { admin, schoolId }
}

// PUT — reset password
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const ctx = await verifyManager(token, params.id)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { password, name } = await req.json()
    if (!password) return NextResponse.json({ error: 'كلمة المرور مطلوبة' }, { status: 400 })

    const updates: any = { password }
    if (name) updates.user_metadata = { name }

    const { error } = await ctx.admin.auth.admin.updateUserById(params.id, updates)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE — remove supervisor
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const ctx = await verifyManager(token, params.id)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Delete auth user (cascades to user_profiles via ON DELETE CASCADE)
    const { error } = await ctx.admin.auth.admin.deleteUser(params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
