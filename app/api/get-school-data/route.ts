import { NextRequest, NextResponse } from 'next/server'
import { getSchoolContext } from '@/lib/auth/context'

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const ctx = await getSchoolContext(token)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: school } = await ctx.admin
      .from('schools')
      .select('name')
      .eq('id', ctx.schoolId)
      .single()

    const { data: rec } = await ctx.admin
      .from('school_data')
      .select('rows, config, created_at')
      .eq('school_id', ctx.schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      rows:       rec?.rows   || [],
      config:     rec?.config || {},
      schoolName: school?.name || '',
      role:       ctx.role,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
