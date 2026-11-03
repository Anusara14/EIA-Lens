import type { Analysis, Evidence, Section, Severity } from '../engine'
import seed from '../demo/wct1.json'

/** One row in the Review workspace: an engine rule flag or an expert-review finding. */
export interface Flag {
  id: string
  source: 'engine' | 'expert'
  ruleId: string | null
  section: Section
  severity: Severity
  title: string
  explanation: string
  evidence: Evidence[]
  fix: string
  needsConfirmation: boolean
  agrees?: boolean // expert finding whose rule the engine also flagged
}

export const SECTIONS: Record<Section, string> = {
  A: 'Process & governance',
  B: 'Models',
  C: 'EMP & monitoring',
}

const SEV = { High: 0, Medium: 1, Low: 2 } as const

export function buildFlags(a: Analysis, isDemo: boolean): Flag[] {
  const engine: Flag[] = a.findings
    .filter((f) => f.status === 'flag')
    .map((f) => ({
      id: f.ruleId,
      source: 'engine',
      ruleId: f.ruleId,
      section: f.section,
      severity: f.severity,
      title: f.title,
      explanation: f.explanation,
      evidence: f.evidence,
      fix: f.fix,
      needsConfirmation: !!f.needsConfirmation,
    }))
  const flaggedRules = new Set(engine.map((f) => f.ruleId))

  const expert: Flag[] = isDemo
    ? seed.findings.map((f) => ({
        id: f.id,
        source: 'expert',
        ruleId: f.ruleId,
        section: f.section as Section,
        severity: f.severity as Severity,
        title: f.title,
        explanation: 'Expert review finding (seed).',
        evidence: [{ quote: f.quote, pdfPage: a.labels[f.label] ?? 1, label: f.label }],
        fix: f.fix,
        needsConfirmation: false,
        agrees: f.ruleId ? flaggedRules.has(f.ruleId) : undefined,
      }))
    : []

  return [...engine, ...expert].sort((x, y) => x.section.localeCompare(y.section) || SEV[x.severity] - SEV[y.severity])
}
