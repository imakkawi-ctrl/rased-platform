import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface SchoolContext {
  userId:   string
  schoolId: string
  role:     string
  admin:    ReturnType<typeof createClient>
}

/**
 * Verifies a Bearer token and returns the school context.
 * Supports both managers (no user_profiles row → schoolId = userId)
 * and regular users (supervisor / teacher / viewer).
 * Returns null if the token is invalid or no school can be resolved.
 */
export async function getSchoolContext(token: string): Promise<SchoolContext | null> {
  if (!token) return null

  // Step 1: verify token with anon key
  const userClient = createClient(SUPA_URL, SUPA_KEY)
  const { data: { user }, error: authErr } = await userClient.auth.getUser(token)
  if (authErr || !user) return null

  // Step 2: look up user_profiles (supervisor / teacher / viewer)
  const admin = createClient(SUPA_URL, SVC_KEY)
  const { data: profile } = await admin
    .from('user_profiles')
    .select('school_id, role')
    .eq('id', user.id)
    .single()

  if (profile?.school_id) {
    return {
      userId:   user.id,
      schoolId: profile.school_id,
      role:     profile.role || 'viewer',
      admin,
    }
  }

  // Step 3: manager fallback — schools.id = auth.uid()
  const { data: school } = await admin
    .from('schools')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (school) {
    return {
      userId:   user.id,
      schoolId: user.id,
      role:     school.role || 'manager',
      admin,
    }
  }

  return null
}
