import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles')
      .select('school_id').eq('id', user.id).single()

    // Manager fallback: managers have no user_profiles row, their school_id = user.id
    const schoolId = profile?.school_id ?? user.id
    if (!schoolId) return NextResponse.json({ error: 'لم يتم تعيين مدرسة لهذا الحساب' }, { status: 400 })

    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { parsed, sheetUrl } = await req.json()

    await admin.from('school_data').delete().eq('school_id', schoolId)
    const { error } = await admin.from('school_data').insert({
      school_id: schoolId,
      file_name: 'google_sheet',
      headers: ['name','grade','class','stage','semester','year',...parsed.subjects],
      rows: parsed.students,
      config: {
        format: 'v2',
        subjects: parsed.subjects,
        meta: parsed.meta,
        risk: 60,
        defaultTarget: 80,
        teachers: parsed.teachers,
        targets: parsed.targets,
        sheetUrl: sheetUrl || null,
        lastSync: new Date().toISOString(),
      }
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
