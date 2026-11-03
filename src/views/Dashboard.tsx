import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Check, ClipboardCheck, FileText, Gauge, Scale, Target, TriangleAlert, X } from 'lucide-react'
import type { AreaGrade, Finding, Grade } from '../engine'
import { useStore } from '../store'
import seed from '../demo/wct1.json'
import { Card, EvidencePill, OutlinePill, ProgressBar, RatingPill } from '../ui/kit'

gsap.registerPlugin(useGSAP)

// Grade → surface, matching the rating language: strong = deep mint, weak = white-mint.
const GRADE_BG: Record<Grade, string> = {
  A: 'bg-mint-600', B: 'bg-mint-500', C: 'bg-mint-400', D: 'bg-mint-300', E: 'bg-mint-50', F: 'bg-mint-50',
}
const SEV_ORDER = { High: 0, Medium: 1, Low: 2 } as const

function ReviewTiers({ grades }: { grades: AreaGrade[] }) {
  return (
    <ol className="flex flex-col">
      {grades.map((g, i) => (
        <li
          key={g.area}
          data-rise
          className={`flex items-center justify-between gap-3 rounded-[22px] px-5 pt-3.5 pb-7 text-on-mint ${GRADE_BG[g.grade]} ${i ? '-mt-4' : ''}`}
          style={{ marginInline: `${i * 6}px` }}
          title={g.reasons.join(' ')}
        >
          <span className="min-w-0">
            <span className="block text-[14px] font-medium">{g.area}</span>
            <span className="block truncate text-[12.5px] opacity-80">{g.reasons[0]}</span>
          </span>
          <span className="num text-[30px] leading-none font-light" aria-label={`grade ${g.grade}`}>{g.grade}</span>
        </li>
      ))}
    </ol>
  )
}

function RuleRow({ f }: { f: Finding }) {
  const openEvidence = useStore((s) => s.openEvidence)
  const ev = f.evidence[0]
  const flag = f.status === 'flag'
  const Icon = flag ? X : Check
  return (
    <li data-rise>
      <button
        type="button"
        disabled={!ev}
        onClick={() => ev && openEvidence({ pdfPage: ev.pdfPage, quote: ev.quote })}
        className={`flex w-full items-center gap-3 rounded-[16px] px-3.5 py-2.5 text-left text-on-mint transition-transform hover:-translate-y-px disabled:hover:translate-y-0 ${
          f.status === 'pass' ? 'bg-mint-500' : f.status === 'na' ? 'bg-card-2 text-ink-2' : 'bg-mint-50'
        }`}
      >
        <span className={`grid size-5 shrink-0 place-items-center rounded-md ${flag ? 'bg-on-mint text-mint-50' : 'bg-on-mint/15'}`}>
          <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
        </span>
        <span className="num w-7 shrink-0 text-[12px] opacity-70">{f.ruleId}</span>
        <span className="min-w-0 flex-1 truncate text-[13.5px]">{f.title}</span>
        <span className="sr-only">{f.status === 'flag' ? 'flagged' : f.status === 'pass' ? 'passed' : 'not applicable'}</span>
        {flag && <span className="shrink-0 text-[12px] font-medium opacity-75">{f.severity}</span>}
        {ev?.label && <span className="hidden shrink-0 text-[12px] opacity-60 xl:inline">p. {ev.label}</span>}
      </button>
    </li>
  )
}

function AuditBars({ auditable, vague, unstated }: { auditable: number; vague: number; unstated: number }) {
  const total = auditable + vague + unstated || 1
  const bars = [
    { label: 'Auditable', n: auditable, cls: 'bg-mint-500', note: 'number + unit + place or time' },
    { label: 'Vague', n: vague, cls: 'bg-mint-50', note: '"minimal", "negligible", no number' },
    { label: 'Not stated', n: unstated, cls: 'bg-mint-300', note: 'predictive, but no magnitude' },
  ]
  const max = Math.max(...bars.map((b) => b.n)) || 1
  return (
    <div className="flex h-[300px] items-end gap-0">
      {bars.map((b) => (
        <div
          key={b.label}
          data-grow
          className={`flex flex-1 flex-col items-center justify-center rounded-[22px] px-2 text-center text-on-mint ${b.cls}`}
          // ponytail: 38% floor keeps the label readable on small bars; the % printed inside is the true share.
          style={{ height: `${38 + (b.n / max) * 62}%` }}
          title={b.note}
        >
          <span className="text-[13px]">{b.label}</span>
          <span className="num text-[30px] font-light">{Math.round((b.n / total) * 100)}%</span>
          <span className="num text-[12px] opacity-70">{b.n} sentences</span>
        </div>
      ))}
    </div>
  )
}

export function Dashboard() {
  const analysis = useStore((s) => s.analysis)
  const isDemo = useStore((s) => s.isDemo)
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.card', { y: 16, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'expo.out' })
        gsap.from('[data-rise]', { y: 10, opacity: 0, duration: 0.45, stagger: 0.025, delay: 0.15, ease: 'expo.out' })
        gsap.from('[data-grow]', { scaleY: 0, transformOrigin: 'bottom', duration: 0.55, stagger: 0.08, delay: 0.2, ease: 'expo.out' })
        gsap.from('[data-fill]', { width: 0, duration: 0.6, delay: 0.3, ease: 'expo.out' })
        gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
          const end = Number(el.dataset.count)
          const o = { v: 0 }
          gsap.to(o, { v: end, duration: 0.6, delay: 0.25, ease: 'expo.out', onUpdate: () => { el.textContent = `${Math.round(o.v)}${el.dataset.suffix ?? '%'}` } })
        })
      })
      return () => mm.revert()
    },
    { scope: root, dependencies: [analysis?.analysedAt] },
  )

  if (!analysis) return null
  const { findings, grades, auditability: aud, ratings, decision, readiness } = analysis

  const sorted = [...findings].sort((a, b) => {
    const s = (f: Finding) => (f.status === 'flag' ? 0 : f.status === 'na' ? 2 : 1)
    return s(a) - s(b) || SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
  })
  const passed = findings.filter((f) => f.status === 'pass').length
  const flagged = findings.filter((f) => f.status === 'flag').length
  const auditPct = Math.round(aud.score * 100)

  // Engine vs expert review (seed). Only seed findings tied to a rule can be compared.
  const linked = isDemo ? seed.findings.filter((f) => f.ruleId) : []
  const agree = linked.filter((f) => findings.some((e) => e.ruleId === f.ruleId && e.status === 'flag')).length
  // Point the footer at the weakest graded area that has evidence.
  const gradeEv = [...grades].filter((g) => g.evidence.length).sort((a, b) => a.grade.localeCompare(b.grade)).at(-1)?.evidence[0]
  const audEv = aud.examples.vague[0]

  const cov = analysis.coverage
  const warnings = [
    cov.scannedShare > 0.3 && `${Math.round(cov.scannedShare * 100)}% of pages have no text layer (scanned images). The rules cannot read them, so missing checks may show as "not applicable"; run the PDF through OCR first for a full review.`,
    !cov.english && 'This report does not appear to be in English. The rules and keyword lists are English-only, so treat every result as unreliable.',
  ].filter(Boolean) as string[]

  return (
    <div ref={root} className="flex flex-col gap-4">
      {warnings.length > 0 && (
        <div role="status" className="flex flex-col gap-1.5 rounded-[24px] bg-mint-50 px-5 py-4 text-[14px] leading-relaxed text-on-mint">
          <span className="flex items-center gap-2 font-medium"><TriangleAlert className="size-4" aria-hidden /> Limited reading</span>
          {warnings.map((w) => <p key={w}>{w}</p>)}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card icon={FileText} title="Review quality" aside={<OutlinePill>Indicative · reviewer confirms</OutlinePill>}>
          <RatingPill rating={ratings.review} />
          <ReviewTiers grades={grades} />
          <EvidencePill ev={gradeEv} />
        </Card>

        <Card icon={ClipboardCheck} title="Model audit" aside={<span className="num text-[13px] text-ink-2"><span data-count={passed} data-suffix="">{passed}</span> / {findings.length} passed</span>}>
          <RatingPill rating={ratings.model} />
          {findings.filter((f) => f.status === 'na').length >= 4 && (
            <p className="text-[13.5px] leading-relaxed text-ink-2">No predictive model (AERMOD, MIKE 21, CORMIX…) is named, so the model rules do not apply. Impacts in this report are judged qualitatively.</p>
          )}
          <ol className="flex flex-col gap-1.5" aria-label={`${flagged} of ${findings.length} rules flagged`}>
            {sorted.map((f) => (
              <RuleRow key={f.ruleId} f={f} />
            ))}
          </ol>
          <EvidencePill ev={sorted[0]?.evidence[0]} />
        </Card>

        <Card className="md:col-span-2 xl:col-span-1" icon={Target} title="Auditability" aside={<OutlinePill>Wood et al. 2000: 44% unauditable</OutlinePill>}>
          <RatingPill rating={ratings.auditability} />
          <p className="text-[14px] leading-relaxed text-ink-2">
            <span data-count={auditPct} className="num text-ink">{auditPct}%</span> of predictions can be tested after construction. The rest are vague or give no magnitude.
          </p>
          <AuditBars auditable={aud.auditable} vague={aud.vague} unstated={aud.unstated} />
          <EvidencePill ev={audEv ? { quote: audEv.sentence, pdfPage: audEv.pdfPage, label: audEv.label } : undefined} prefix="Vague example," />
        </Card>
      </div>

      <section aria-label="Decision" className="card flex flex-col gap-5 rounded-[var(--radius-card)] bg-card p-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <h2 className="flex items-center gap-2.5 text-[15px]">
            <Scale className="size-[18px] text-ink-2" strokeWidth={1.6} aria-hidden /> Recommended decision
          </h2>
          <ul className="flex flex-wrap gap-2" aria-label="Recommendation">
            {(['Approve', 'Approve with conditions', 'Revise'] as const).map((d) => (
              <li
                key={d}
                aria-current={d === decision ? 'true' : undefined}
                className={`rounded-full px-4 py-2 text-[15px] ${d === decision ? 'bg-mint-50 font-medium text-on-mint' : 'border border-line text-ink-2'}`}
              >
                {d}
              </li>
            ))}
          </ul>
          <OutlinePill>Human decision required: the planner decides</OutlinePill>
          {linked.length > 0 && (
            <span className="text-[13.5px] text-ink-2 lg:ml-auto">
              Engine agrees with expert review on{' '}
              <span className="num text-ink">{agree} / {linked.length}</span> rule-linked findings ({Math.round((agree / linked.length) * 100)}%)
            </span>
          )}
        </div>
        {isDemo && decision === 'Revise' && (
          <ul className="grid gap-2 text-[14px] text-ink sm:grid-cols-2 xl:grid-cols-4">
            {seed.conditions.map((c) => (
              <li key={c} className="rounded-2xl bg-card-2 px-4 py-3 leading-snug">{c}</li>
            ))}
          </ul>
        )}
        <ProgressBar value={readiness} goal={75} label="Readiness for approval" goalLabel="approvable" icon={Gauge} />
      </section>
    </div>
  )
}
