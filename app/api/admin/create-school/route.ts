import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'i.makkawi@waadacademy.edu.sa'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export async function POST(req: NextRequest) {
  // Verify caller is admin
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, email, password, role, days } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'البيانات ناقصة' }, { status: 400 })
  }

  const admin = getServiceClient()

  // 1. Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email verification
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const userId = authData.user?.id
  if (!userId) return NextResponse.json({ error: 'لم يُنشأ المستخدم' }, { status: 500 })

  // 2. Calculate license expiry
  const expiry = new Date(Date.now() + Number(days || 365) * 86400000).toISOString().split('T')[0]

  // 3. Insert into schools table
  const { error: dbError } = await admin.from('schools').insert({
    id: userId,
    name,
    email,
    role: role || 'manager',
    license_expiry: expiry,
  })

  if (dbError) {
    // Rollback: delete the auth user
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, userId })
}
