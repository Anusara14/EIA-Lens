import { useStore } from '../store'
import { buildFlags, SECTIONS } from '../lib/flags'
import { DEVELOPER } from '../ui/kit'
import seed from '../demo/wct1.json'

/** A4 summary rendered only when printing ("Export report" → Save as PDF). */
export function PrintReport() {
  const { analysis, docName, isDemo } = useStore()
  if (!analysis) return null
  const flags = buildFlags(analysis, false).filter((f) => f.severity === 'High').concat(buildFlags(analysis, false).filter((f) => f.severity !== 'High'))
  const expert = isDemo ? buildFlags(analysis, true).filter((f) => f.source === 'expert' && f.severity === 'High') : []
  const date = new Date(analysis.analysedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  const pg = (e?: { label: string | null; pdfPage: number }) => (e ? (e.label ? `p. ${e.label}` : `PDF p. ${e.pdfPage}`) : '')

  return (
    <article className="hidden bg-white text-[10.5pt] leading-snug text-black print:block">
      <header className="mb-5 border-b border-black pb-3">
        <p className="text-[9pt] tracking-wide">EIA-Lens review summary · {date}</p>
        <h1 className="text-[20pt] font-light">{docName}</h1>
      </header>

      <section className="mb-5 grid grid-cols-4 gap-3">
        {[
          ['Recommended decision', analysis.decision],
          ['Review quality', analysis.ratings.review],
          ['Model audit', `${analysis.findings.filter((f) => f.status === 'pass').length} / ${analysis.findings.length} passed`],
          ['Auditability', `${Math.round(analysis.auditability.score * 100)}% testable`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-black/40 p-2.5">
            <p className="text-[8.5pt]">{k}</p>
            <p className="text-[14pt] font-light">{v}</p>
          </div>
        ))}
      </section>
      <p className="mb-5">Readiness for approval: <b>{analysis.readiness}%</b> (75% = approvable). Human decision required: the planner decides.</p>

      <h2 className="mb-1.5 text-[12pt] font-medium">Review areas (indicative)</h2>
      <table className="mb-5 w-full border-collapse text-left">
        <tbody>
          {analysis.grades.map((g) => (
            <tr key={g.area} className="border-t border-black/20">
              <td className="py-1 pr-3">{g.area}</td>
              <td className="py-1 pr-3 font-medium">{g.grade}</td>
              <td className="py-1">{g.reasons.join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-1.5 text-[12pt] font-medium">Model audit flags</h2>
      <ol className="mb-5 flex flex-col gap-2">
        {flags.map((f) => (
          <li key={f.id} className="break-inside-avoid">
            <p><b>{f.ruleId} · {f.severity} · {SECTIONS[f.section]}</b>: {f.title} ({f.evidence.map(pg).join(', ')})</p>
            <p>{f.explanation}</p>
            <p><i>Suggested fix:</i> {f.fix}</p>
          </li>
        ))}
      </ol>

      {expert.length > 0 && (
        <>
          <h2 className="mb-1.5 text-[12pt] font-medium">Expert review, high severity</h2>
          <ul className="mb-5 flex flex-col gap-1.5">
            {expert.map((f) => <li key={f.id} className="break-inside-avoid"><b>{f.id}</b> {f.title} ({pg(f.evidence[0])}). <i>Fix:</i> {f.fix}</li>)}
          </ul>
          <h2 className="mb-1.5 text-[12pt] font-medium">Conditions before resubmission</h2>
          <ul className="mb-5 list-disc pl-5">{seed.conditions.map((c) => <li key={c}>{c}</li>)}</ul>
        </>
      )}

      <footer className="border-t border-black pt-2 text-[8.5pt]">
        EIA-Lens prototype · findings are decision support; the planner decides. Satellite turbidity is indicative unless calibrated. Page references use the printed ESIA page labels.
        <br />
        Developed by {DEVELOPER.name} · {DEVELOPER.url.replace('https://', '')}
      </footer>
    </article>
  )
}
