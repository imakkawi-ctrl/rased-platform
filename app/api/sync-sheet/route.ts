import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals: string[] = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
      else cur += ch
    }
    vals.push(cur.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (vals[i] || '').replace(/^"|"$/g, '') })
    return row
  }).filter(r => Object.values(r).some(v => v))
}

function normKey(k: string): string {
  return k.trim().replace(/\s+Q([1-4])$/i, '-Q$1').replace(/_Q([1-4])$/i, '-Q$1')
}

function detectSubjectCols(keys: string[]): string[] {
  for (const re of [/^.+-Q[1-4]$/i, /^.+\sQ[1-4]$/i, /^.+_Q[1-4]$/i]) {
    const cols = keys.filter(k => re.test(k.trim()))
    if (cols.length) return cols
  }
  return []
}

async function fetchCSV(sheetId: string, tabName: string): Promise<Record<string,string>[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`
  try {
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) return []
    const text = await r.text()
    if (text.includes('{"version"') || text.trim().length < 10) return []
    return parseCSV(text)
  } catch { return [] }
}

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

async function fetchAllTabs(sheetId: string) {
  let grades: Record<string,string>[] = []
  for (const n of ['Grades','grades','GRADES','Scores','scores']) {
    grades = await fetchCSV(sheetId, n)
    if (grades.length) break
  }
  let teachers: Record<string,string>[] = []
  for (const n of ['Teachers','teachers','المعلمون','المعلمين']) {
    teachers = await fetchCSV(sheetId, n)
    if (teachers.length) break
  }
  let targets: Record<string,string>[] = []
  for (const n of ['Targets','targets','الأهداف']) {
    targets = await fetchCSV(sheetId, n)
    if (targets.length) break
  }
  return { grades, teachers, targets }
}

function buildStudents(rows: Record<string,string>[]) {
  const allKeys = Object.keys(rows[0] || {})
  const subjectCols = detectSubjectCols(allKeys)
  if (!subjectCols.length) throw new Error('No subject columns found')
  const normCols = subjectCols.map(normKey)
  const subjects = Array.from(new Set(normCols.map(k => k.replace(/-Q[1-4]$/i, '').trim())))
  const students = rows.map(r => {
    const name = String(r['Name'] || r['name'] || '').trim()
    const grade = String(r['Grade'] || r['grade'] || '').trim()
    const cls = String(r['Class'] || r['class'] || '').trim()
    const stage = String(r['Stage'] || r['stage'] || '').trim()
    const semester = String(r['Semester'] || r['semester'] || '').trim()
    const year = String(r['Academic Year'] || r['year'] || '').trim()
    const school = String(r['School'] || r['school'] || '').trim()
    const grades: Record<string, Record<string, number>> = {}
    for (const subj of subjects) {
      grades[subj] = {}
      for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) {
        const orig = subjectCols.find(k => normKey(k) === `${subj}-${q}`)
        if (orig) {
          const v = r[orig]
          grades[subj][q] = (v === '' || v == null) ? NaN : Number(v)
        }
      }
    }
    return { name, grade, class: cls, stage, semester, year, school, grades }
  }).filter(s => s.name)
  return { students, subjects }
}

function buildTeachers(rows: Record<string,string>[]) {
  return rows.map(r => {
    const name = String(r['Teacher Name'] || r['Name'] || r['name'] || '').trim()
    const subject = String(r['Subject'] || r['subject'] || '').trim()
    const year = String(r['Academic Year'] || '').trim()
    const sections: string[] = []
    for (let i = 1; i <= 15; i++) {
      const v = String(r[`Section ${i}`] || '').trim()
      if (v) sections.push(v)
    }
    return { name, subject, sections, year }
  }).filter(t => t.name && t.subject)
}

function buildTargets(rows: Record<string,string>[]) {
  return rows.map(r => ({
    subject: String(r['Subject'] || r['subject'] || '').trim(),
    target: Number(r['Target (%)'] || r['Target'] || r['target'] || 80),
    year: String(r['Academic Year'] || '').trim(),
  })).filter(t => t.subject)
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify user token
    const userSupa = createClient(SUPA_URL, SUPA_KEY)
    const { data: { user }, error: authErr } = await userSupa.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Use service role for ALL database reads — bypasses RLS entirely
    const admin = createClient(SUPA_URL, SVC_KEY)

    // Get school_id from user_profiles
    const { data: profile } = await admin.from('user_profiles')
      .select('school_id').eq('id', user.id).single()
    let schoolId = profile?.school_id

    // Fallback: if no user_profiles row, school_id = user.id (direct schools table)
    if (!schoolId) {
      const { data: school } = await admin.from('schools').select('id').eq('id', user.id).single()
      if (school) schoolId = user.id
    }

    if (!schoolId) return NextResponse.json({ error: 'No school assigned to this account' }, { status: 400 })

    // Get stored config — use service role to bypass RLS
    const { data: rec } = await admin.from('school_data')
      .select('config')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1).single()

    const sheetUrl: string = rec?.config?.sheetUrl || ''
    if (!sheetUrl) return NextResponse.json({ error: 'No sheet URL stored — upload your sheet first' }, { status: 400 })

    const sheetId = extractSheetId(sheetUrl)
    if (!sheetId) return NextResponse.json({ error: 'Invalid sheet URL' }, { status: 400 })

    const { grades, teachers, targets } = await fetchAllTabs(sheetId)
    if (!grades.length) return NextResponse.json({ error: 'Could not fetch Grades tab — check sharing settings' }, { status: 400 })

    const { students, subjects } = buildStudents(grades)
    const teacherList = buildTeachers(teachers)
    const targetList  = buildTargets(targets)

    const uniqueGrades = Array.from(new Set(students.map(s => s.grade).filter(Boolean)))
    const uniqueSem    = Array.from(new Set(students.map(s => s.semester).filter(Boolean)))

    const newConfig = {
      ...(rec?.config || {}),
      format: 'v2',
      subjects,
      teachers: teacherList,
      targets: targetList,
      risk: rec?.config?.risk || 60,
      defaultTarget: rec?.config?.defaultTarget || 80,
      meta: { semester: uniqueSem[0], year: students[0]?.year || '', grades: uniqueGrades },
      sheetUrl,
      lastSync: new Date().toISOString(),
    }

    await admin.from('school_data').delete().eq('school_id', schoolId)
    const { error: insertErr } = await admin.from('school_data').insert({
      school_id: schoolId,
      file_name: 'google_sheet',
      headers: ['name', 'grade', 'class', 'stage', 'semester', 'year', ...subjects],
      rows: students,
      config: newConfig,
    })

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      students: students.length,
      subjects: subjects.length,
      teachers: teacherList.length,
      lastSync: newConfig.lastSync,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
