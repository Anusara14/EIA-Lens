export interface Page {
  index: number // 1-based PDF page number
  label: string | null // printed ESIA label, e.g. "7-62"
  text: string // whitespace-normalised page text
}

export interface Evidence {
  quote: string
  pdfPage: number
  label: string | null
}

export type Status = 'pass' | 'flag' | 'na'
export type Severity = 'High' | 'Medium' | 'Low'
export type Section = 'A' | 'B' | 'C'

export interface Finding {
  ruleId: string
  title: string
  section: Section
  status: Status
  severity: Severity
  explanation: string
  evidence: Evidence[]
  fix: string
  needsConfirmation?: boolean
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
export type Rating = 'Excellent' | 'Average' | 'Poor'

export interface AreaGrade {
  area: string
  grade: Grade
  reasons: string[]
  evidence: Evidence[]
}

export interface Prediction {
  sentence: string
  kind: 'auditable' | 'vague' | 'unstated'
  pdfPage: number
  label: string | null
}

export interface Auditability {
  auditable: number
  vague: number
  unstated: number
  score: number // auditable / (auditable + vague), 0..1
  examples: { auditable: Prediction[]; vague: Prediction[] }
}

export type Decision = 'Approve' | 'Approve with conditions' | 'Revise'

export interface EmpItem {
  id: string
  code: string // "A.1"
  activity: string
  promise: string
  owner: string | null
  frequency: string | null
  hasNumber: boolean
  hasDate: boolean
  hasBudget: boolean
  smart: number // 0..4: owner, number, date, budget
  training: 'None' | 'Listed' | 'Not stated'
  pdfPage: number
  label: string | null
}

export interface GeoPoint {
  lat: number
  lng: number
  pdfPage: number
  label: string | null
  quote: string
}

/** Where the report says the project is, found from its own text. */
export interface Location {
  source: 'coordinates' | 'place' | 'none'
  points: GeoPoint[]
  place: { name: string; lat: number; lng: number; evidence: Evidence; country: string | null; uncertaintyKm: number } | null
  radius: { km: number; evidence: Evidence } | null
  center: [number, number] | null // [lng, lat]
  bbox: [number, number, number, number] | null // west, south, east, north
}

export interface MonitoringSeries {
  name: string
  unit: string
  limit: number
  values: { code: string; value: number }[]
  quote: string // text of the first row, for highlighting
  pdfPage: number
  label: string | null
}

/** How much of the PDF the rules could actually read. */
export interface Coverage {
  textPages: number // pages with a usable text layer
  scannedShare: number // 0..1 of pages with (almost) no text: scans that need OCR
  english: boolean // the rules and keyword lists are English
}

export interface Analysis {
  pageCount: number
  labelledPages: number
  findings: Finding[]
  grades: AreaGrade[]
  auditability: Auditability
  ratings: { review: Rating; model: Rating; auditability: Rating }
  decision: Decision
  readiness: number // 0..100
  labels: Record<string, number> // printed label → PDF page
  emp: EmpItem[]
  monitoring: MonitoringSeries | null
  location: Location
  coverage: Coverage
  analysedAt: number
}
