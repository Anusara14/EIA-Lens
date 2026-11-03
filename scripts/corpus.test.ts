// Runs the engine over a folder of EIA PDFs and prints a summary.
// EIA_CORPUS="path/to/folder" npx vitest run scripts/corpus.test.ts
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { extractPages } from '../src/pdf/extract'
import { analyse } from '../src/engine'
import { empPages, impactPages } from '../src/engine/text'

const dir = process.env.EIA_CORPUS ?? ''
const span = (ps: { index: number }[]) => (ps.length ? `PDF ${ps[0].index}–${ps.at(-1)!.index} (${ps.length} p.)` : 'none')
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')) : []

describe.skipIf(!files.length)('EIA corpus', () => {
  it.each(files)('%s', async (file) => {
    const t0 = performance.now()
    const doc = await getDocument({ data: new Uint8Array(readFileSync(join(dir, file))), verbosity: 0 }).promise
    const pages = await extractPages(doc)
    const t1 = performance.now()
    const a = analyse(pages)
    const chars = pages.reduce((s, p) => s + p.text.length, 0)
    const st = (s: string) => a.findings.filter((f) => f.status === s).map((f) => f.ruleId).join(',') || '-'
    const lines = [
      `\n### ${file}`,
      `pages ${a.pageCount} · labelled ${a.labelledPages} · text ${Math.round(chars / 1000)}k chars · extract ${Math.round(t1 - t0)} ms · analyse ${Math.round(performance.now() - t1)} ms`,
      `flag: ${st('flag')} | pass: ${st('pass')} | na: ${st('na')}`,
      `grades: ${a.grades.map((g) => `${g.area}=${g.grade}`).join(', ')}`,
      `auditability ${Math.round(a.auditability.score * 100)}% (${a.auditability.auditable}/${a.auditability.vague}/${a.auditability.unstated}) · emp ${a.emp.length} · monitoring ${a.monitoring ? `${a.monitoring.name} n=${a.monitoring.values.length} limit ${a.monitoring.limit} p.${a.monitoring.label ?? a.monitoring.pdfPage}` : '-'}`,
      `chapters: EMP ${span(empPages(pages))} · impacts ${span(impactPages(pages))} · R10 ${a.findings[9].status}: ${a.findings[9].explanation.slice(0, 90)} [${a.findings[9].evidence.map((e) => e.label ?? e.pdfPage).join(',')}]`,
      `location ${a.location.source} · points ${a.location.points.length} · centre ${a.location.center?.map((v) => v.toFixed(3)).join(', ') ?? '-'} · place ${a.location.place?.name ?? '-'} · radius ${a.location.radius ? `${a.location.radius.km} km p.${a.location.radius.evidence.label ?? a.location.radius.evidence.pdfPage}` : '-'}`,
      `ratings ${JSON.stringify(a.ratings)} · decision ${a.decision} · readiness ${a.readiness}%`,
      ...a.findings.filter((f) => f.status === 'flag').map((f) => `  ${f.ruleId}: ${f.explanation.slice(0, 150)} [${f.evidence.map((e) => e.label ?? `pdf${e.pdfPage}`).join(',')}]`),
    ]
    process.stdout.write(lines.join('\n') + '\n')
    expect(a.findings).toHaveLength(10)
  }, 300_000)
})
