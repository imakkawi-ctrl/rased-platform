export type School = {
  id: string
  name: string
  email: string
  license_expiry: string
  created_at: string
}

export type Student = {
  id: string
  school_id: string
  name: string
  grade: string
  class: string
  stage: string
  semester: string
  academic_year: string
  created_at: string
}

export type Score = {
  id: string
  student_id: string
  school_id: string
  subject: string
  score: number
  performance_grade: string
  q1: number | null
  q2: number | null
  q3: number | null
  q4: number | null
  created_at: string
}
