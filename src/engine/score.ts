import type { AreaGrade, Auditability, Decision, Finding, Grade, Page, Prediction, Rating } from './types'
import { evidenceFrom, findAll, impactPages, isTocPage } from './text'

// ---------- Auditability (Wood et al. 2000; Buckley 1991) ----------

const PREDICTIVE = /\b(will|would|is expected|are expected|predicted|likely|unlikely|impacts?)\b/i
const NUM_UNIT = /\d[\d,.]*\s?(mg\/l|µg\/l|ug\/l|mg\/m3|mg\/m³|µg\/m3|µg\/m³|ug\/m3|mg\/kg|ppm|ppb|dB\s?\(?[AC]?\)?|dBA|mm\/s|m\/s|km2|km²|km|ha\b|acres?|m3\/s|m³\/s|l\/s|m3|m³|m2|m²|m\b|%|°C|tCO2e?|tCO₂e?|[kM]t\b|tonnes?|t\/yr|kg\/s|kg\/day|NTU|MW|GWh|kWh|vehicles?\/(?:hr|hour|day))/i
const PLACE_TIME = /\b(at|within|from the|km|receptor|station|boundary|shore|site|[A-Z]{1,3}-?\d{1,2}|during|year|month|day|hours?|night|construction|operation|20\d\d)\b/i
const VAGUE = /\b(minimal|negligible|insignificant|unlikely|remote|low|minor|limited|not significant)\b/i

export function scoreAuditability(pages: Page[]): Auditability {
  // Prefer the impact chapter; fall back to the whole report.
  let scope = impactPages(pages)
  if (scope.length < 3) scope = pages.filter((p) => !isTocPage(p))
  const preds: Prediction[] = []
  for (const p of scope) {
    // Drop the running page header (report title, version, "Page 7-11 …") before splitting.
    const fr = p.text.search(/Final Report/i)
    const body = fr >= 0 ? p.text.slice(fr + 12).replace(/^\s*[A-Z &]{4,60}\b(?=\s)/, '') : p.text
    for (const s of body.split(/(?<=[.;])\s+(?=[A-Z■◼•])/)) {
      if (s.length < 40 || s.length > 600 || !PREDICTIVE.test(s)) continue
      const sentence = s.trim()
      const quantified = NUM_UNIT.test(sentence) && PLACE_TIME.test(sentence)
      const kind: Prediction['kind'] = quantified ? 'auditable' : VAGUE.test(sentence) ? 'vague' : 'unstated'
      preds.push({ sentence, kind, pdfPage: p.index, label: p.label })
    }
  }
  const auditable = preds.filter((p) => p.kind === 'auditable')
  const vague = preds.filter((p) => p.kind === 'vague')
  const denom = auditable.length + vague.length
  return {
    auditable: auditable.length,
    vague: vague.length,
    unstated: preds.length - denom,
    score: denom ? auditable.length / denom : 0,
    examples: { auditable: auditable.slice(0, 4), vague: vague.slice(0, 4) },
  }
}

// ---------- Review quality (simplified Lee & Colley, indicative) ----------

const GRADES: Grade[] = ['F', 'E', 'D', 'C', 'B', 'A']
const toGrade = (n: number): Grade => GRADES[Math.max(0, Math.min(5, Math.round(n)))]
export const gradeValue = (g: Grade): number => GRADES.indexOf(g)

export function gradeReview(pages: Page[], findings: Finding[], aud: Auditability): AreaGrade[] {
  const has = (re: RegExp) => findAll(pages, re)
  const flagged = (...ids: string[]) => findings.filter((f) => ids.includes(f.ruleId) && f.status === 'flag').length

  // Description of the project
  const desc = has(/project description|site layout|dredg\w+ volume|15 million|capacity of|construction schedule/i)
  const description: AreaGrade = { area: 'Description', grade: toGrade(desc.length > 5 ? 4 : desc.length ? 3 : 1),
    reasons: desc.length ? ['Project components, quantities and layout are described.'] : ['Project description is thin.'], evidence: evidenceFrom(desc, 1) }

  // Baseline
  let base = 4
  const reasonsB: string[] = []
  const visit = has(/site (assessment|visit|reconnaissance)[^.]{0,80}?\d{1,2}\s?[-–]\s?\d{1,2}\s+[A-Z][a-z]+\s+20\d\d/i)
  if (visit.length) { base -= 1; reasonsB.push('Site work was a few days only.') }
  if (flagged('R1')) { base -= 1; reasonsB.push('Air model met data covers a single season.') }
  if (flagged('R6')) { base -= 1; reasonsB.push('Baseline is already near or over limits.') }
  const baseline: AreaGrade = { area: 'Baseline', grade: toGrade(base), reasons: reasonsB.length ? reasonsB : ['Baseline appears complete.'], evidence: evidenceFrom(visit, 1) }

  // Impact prediction: driven by model audit and auditability
  const modelFlags = flagged('R1', 'R2', 'R3', 'R4', 'R5', 'R7', 'R8')
  // No named model at all (R1–R4 not applicable) means predictions are qualitative: cap at C.
  const noModels = ['R1', 'R2', 'R3', 'R4'].every((id) => findings.find((f) => f.ruleId === id)?.status === 'na')
  const ip = Math.min(noModels ? 3 : 5, 5 - modelFlags * 0.6) - (aud.score < 0.5 ? 1 : 0)
  const impact: AreaGrade = { area: 'Impact prediction', grade: toGrade(ip),
    reasons: [
      noModels ? 'No predictive model is named; impacts are judged qualitatively.' : `${modelFlags} of 7 model checks flagged.`,
      `${Math.round(aud.score * 100)}% of predictions are testable.`,
    ], evidence: [] }

  // Alternatives & mitigation
  const alt = has(/analysis of alternatives|alternatives? (were|was) (considered|assessed)|no.project (option|alternative|scenario)|without.project scenario/i)
  const priorOnly = has(/(EIA|EIA Report)\s+(Report\s+)?2005[^.]{0,120}?(option|layout)/i)
  let am = alt.length ? 4 : 2
  const reasonsA: string[] = []
  if (!alt.length) reasonsA.push('No alternatives chapter or no-project option.')
  if (priorOnly.length) { am = Math.min(am, 2); reasonsA.push('Siting and layout were fixed in an earlier EIA.') }
  if (flagged('R10')) { am -= 1; reasonsA.push('Mitigation is not costed or SMART.') }
  const alternatives: AreaGrade = { area: 'Alternatives & mitigation', grade: toGrade(am), reasons: reasonsA.length ? reasonsA : ['Alternatives are assessed.'], evidence: evidenceFrom([...priorOnly, ...alt], 1) }

  // Consultation & disclosure
  const consult = has(/stakeholder (engagement|consultation)|public consultation|disclosure|grievance/i)
  const adversarial = has(/combat their influence|counter(act)? (their|the) (opposition|influence)/i)
  let cd = consult.length ? 4 : 1
  const reasonsC: string[] = consult.length ? [] : ['No consultation or disclosure found.']
  if (adversarial.length) { cd = Math.min(cd, 2); reasonsC.push('Stakeholder chapter treats people as opposition to manage.') }
  const consultation: AreaGrade = { area: 'Consultation & disclosure', grade: toGrade(cd), reasons: reasonsC.length ? reasonsC : ['Consultation and disclosure are covered.'], evidence: evidenceFrom(adversarial.length ? adversarial : consult, 1) }

  return [description, baseline, impact, alternatives, consultation]
}

// ---------- Ratings and decision ----------

export function rate(score01: number, good = 0.75, ok = 0.5): Rating {
  return score01 >= good ? 'Excellent' : score01 >= ok ? 'Average' : 'Poor'
}

export function decide(ratings: Rating[]): Decision {
  if (ratings.includes('Poor')) return 'Revise'
  return ratings.every((r) => r === 'Excellent') ? 'Approve' : 'Approve with conditions'
}
