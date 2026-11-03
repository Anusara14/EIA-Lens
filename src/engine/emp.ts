import type { EmpItem, MonitoringSeries, Page } from './types'
import { BUDGET, pagesUnderHeader } from './text'
import { parseLimitTable } from './rules'

const OWNER = /\b(EPC Contractors?|CWIT|SLPA|Contractors?|EHS Team|Project Proponent|Proponent|Port Authority)\b/g
const NUMBER = /\d[\d,.]*\s?(mg\/l|µg\/m3|dB\s?\(?A\)?|dB|km|m3|m³|m\b|%|ppm|NTU|kg|tonnes?|hours?|days?)/i
const TIMED = /\b(daily|weekly|monthly|quarterly|annually|yearly|every \w+|within \d+|prior to|by 20\d\d|\d+ (days|weeks|months))\b/i
const FREQ = /\b(daily|weekly|monthly|quarterly|half.yearly|bi-annual|annual(ly)?|continuous(ly)?|in event of \w+|as and when required)\b/i

/** Body of an EMP page without the running title block. */
function body(p: Page): string {
  const i = p.text.search(/Final Report/i)
  return i >= 0 ? p.text.slice(i + 12) : p.text
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s)

/**
 * Turn ESMP table rows ("A.1 Activity … ■ measure ■ measure … Training: … Reporting") into
 * a promise ledger. Monitoring-programme pages are skipped; they list checks, not promises.
 */
export function extractEmp(pages: Page[]): EmpItem[] {
  let emp = pagesUnderHeader(pages, /^(ENVIRONMENT\w*\s+(AND|&)\s+SOCIAL\s+)?MANAGEMENT PLAN/i)
  if (!emp.length) emp = pages.filter((p) => /Mitigation measure/i.test(p.text))
  // Rows run across pages, so read the chapter as one stream and remember where each page starts.
  let text = ''
  const offsets: { at: number; page: Page }[] = []
  for (const p of emp) {
    if (/Monitoring Programme|EMP Implementation Budget/i.test(p.text)) continue
    offsets.push({ at: text.length, page: p })
    text += body(p).replace(/^.*?Comment \/ Reference/, '') + ' '
  }
  const pageAt = (i: number) => offsets.findLast((o) => o.at <= i)!.page

  const items: EmpItem[] = []
  const starts = [...text.matchAll(/\b([A-H])\.(\d{1,2})\s+(?=[A-Z])/g)]
  {
    starts.forEach((m, k) => {
      const seg = text.slice(m.index, starts[k + 1]?.index ?? text.length).replace(/[◼•]/g, '■')
      const p = pageAt(m.index)
      const bullet = seg.indexOf('■')
      if (bullet < 0) return // a heading or a cross-reference, not a row with measures
      const before = seg.split(/Training\s*:/i)[0]
      const after = seg.slice(before.length)
      const promise = before.slice(bullet + 1).split('■')[0].replace(/[;•]+\s*$/, '').trim()
      // The Responsible column sits just before Schedule/Training, so the last party named wins.
      const owner = [...before.matchAll(OWNER)].at(-1)?.[1] ?? null
      const hasNumber = NUMBER.test(before)
      const hasDate = TIMED.test(before)
      const hasBudget = BUDGET.test(seg)
      items.push({
        id: `${m[1]}.${m[2]}-${p.index}-${k}`, // the ESIA reuses codes (two C.3 rows on p. 9-10), so add the row order

        code: `${m[1]}.${m[2]}`,
        activity: clip(seg.slice(m[0].length, bullet).trim(), 90),
        promise: clip(promise, 200),
        owner,
        frequency: FREQ.exec(after)?.[1] ?? FREQ.exec(before)?.[1] ?? null,
        hasNumber,
        hasDate,
        hasBudget,
        smart: [owner, hasNumber, hasDate, hasBudget].filter(Boolean).length,
        training: /Training\s*:\s*None/i.test(seg) ? 'None' : /Training\s*:/i.test(seg) ? 'Listed' : 'Not stated',
        pdfPage: p.index,
        label: p.label,
      })
    })
  }
  return items
}

/** Longest station-by-station series that sits against a stated limit (e.g. TSS, Table 9.7). */
export function monitoringSeries(pages: Page[]): MonitoringSeries | null {
  let best: MonitoringSeries | null = null
  for (const page of pages) {
    const { rows } = parseLimitTable(page)
    const byLimit = new Map<number, { code: string; value: number }[]>()
    for (const r of rows) byLimit.set(r.limit, [...(byLimit.get(r.limit) ?? []), { code: r.code, value: r.value }])
    for (const [limit, values] of byLimit) {
      if (values.length >= 5 && (!best || values.length > best.values.length)) {
        const unit = /\(mg\/l\)|mg\/l/i.test(page.text) ? 'mg/l' : /µg\/m3/i.test(page.text) ? 'µg/m³' : ''
        const name = /suspended solids|TSS/i.test(page.text) ? 'TSS' : 'Measured value'
        best = { name, unit, limit, values, pdfPage: page.index, label: page.label }
      }
    }
  }
  return best
}
