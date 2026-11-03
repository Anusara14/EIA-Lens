import type { Analysis, Page } from './types'
import { runRules } from './rules'
import { decide, gradeReview, gradeValue, rate, scoreAuditability } from './score'
import { extractEmp, monitoringSeries } from './emp'

export * from './types'

/** Full deterministic analysis. Same pages in → same result out. */
export function analyse(pages: Page[]): Analysis {
  const findings = runRules(pages)
  const auditability = scoreAuditability(pages)
  const grades = gradeReview(pages, findings, auditability)

  const decided = findings.filter((f) => f.status !== 'na')
  const passRate = decided.length ? decided.filter((f) => f.status === 'pass').length / decided.length : 0
  const gradeMean = grades.reduce((s, g) => s + gradeValue(g.grade), 0) / grades.length / 5

  // Passing the few rules that apply is not "Excellent" when no predictive model could be audited at all.
  const modelsAudited = findings.some((f) => ['R1', 'R2', 'R3', 'R4'].includes(f.ruleId) && f.status !== 'na')
  const ratings = {
    review: rate(gradeMean, 0.7, 0.5),
    model: rate(modelsAudited ? passRate : Math.min(passRate, 0.79), 0.8, 0.5),
    auditability: rate(auditability.score, 0.6, 0.4),
  }
  return {
    pageCount: pages.length,
    labelledPages: pages.filter((p) => p.label).length,
    findings,
    grades,
    auditability,
    ratings,
    decision: decide(Object.values(ratings)),
    readiness: Math.round(((gradeMean + passRate + auditability.score) / 3) * 100),
    labels: Object.fromEntries(pages.filter((p) => p.label).map((p) => [p.label!, p.index]).reverse()),
    emp: extractEmp(pages),
    monitoring: monitoringSeries(pages),
    analysedAt: Date.now(),
  }
}
