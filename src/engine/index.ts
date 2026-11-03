import type { Analysis, Coverage, Page } from './types'
import { runRules } from './rules'
import { decide, gradeReview, gradeValue, rate, scoreAuditability } from './score'
import { extractEmp, monitoringSeries } from './emp'
import { locate } from './location'

export * from './types'

const STOPWORDS = /\b(the|and|of|to|in|is|be|will|for|with|are|by|on|this|that)\b/gi

export function coverage(pages: Page[]): Coverage {
  const textPages = pages.filter((p) => p.text.length >= 200).length
  const sample = pages.map((p) => p.text).join(' ').slice(0, 200_000)
  const words = (sample.match(/\p{L}+/gu) ?? []).length
  const stop = (sample.match(STOPWORDS) ?? []).length
  return { textPages, scannedShare: pages.length ? 1 - textPages / pages.length : 1, english: words < 200 || stop / words > 0.06 }
}

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
    location: locate(pages),
    coverage: coverage(pages),
    analysedAt: Date.now(),
  }
}
