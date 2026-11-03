import type { EmpItem, MonitoringSeries, Page } from './types'
import { BUDGET, empPages, isTocPage, quoteAround } from './text'
import { parseLimitTable } from './rules'

const OWNER = /\b(EPC Contractors?|(?:the\s+)?(?:main\s+|civil\s+|construction\s+)?Contractors?|Sub-?contractors?|(?:Project\s+)?Proponent|Developer|Operator|Client|Employer|Concessionaire|EHS\s+(?:Team|Officer|Manager|Department)|HSE\s+(?:Team|Officer|Manager)|Environmental\s+(?:Officer|Manager|Specialist|Unit|Team)|Social\s+(?:Officer|Specialist)|Community\s+Liaison\s+Officer|(?:Supervision|Supervising)\s+Consultant|Resident\s+Engineer|Engineer|PMU|PIU|Project\s+(?:Manager|Management\s+Unit|Implementation\s+Unit)|CWIT|SLPA|Port Authority|Local\s+Authority|Municipality)\b/gi
const NUMBER = /\d[\d,.]*\s?(mg\/l|µg\/l|mg\/m3|µg\/m3|ppm|dB\s?\(?A\)?|dB|km\/h|km|m3|m³|m\b|%|NTU|kg|tonnes?|hours?|days?|litres?|ha\b)/i
const TIMED = /\b(daily|weekly|monthly|quarterly|annually|yearly|every \w+|within \d+|prior to|before (?:the )?(?:start|commencement|construction|operation)|by 20\d\d|\d+ (?:days|weeks|months))\b/i
const FREQ = /\b(daily|weekly|fortnightly|monthly|quarterly|half.yearly|bi-annual(?:ly)?|annual(?:ly)?|continuous(?:ly)?|in event of \w+|as and when required|once)\b/i
const COMMIT = /\b(will|shall|must|should|is to be|are to be|is required to|are required to|ensure)\b/i

const TOPICS: [string, RegExp][] = [
  ['Air quality and dust', /\b(dust|air quality|emission|PM10|PM2\.5|exhaust)\b/i],
  ['Noise and vibration', /\b(noise|vibration|dB)\b/i],
  ['Water and drainage', /\b(water|wastewater|effluent|runoff|drainage|sewage|turbid|sediment)\b/i],
  ['Waste', /\b(waste|garbage|refuse|debris|spoil|recycl)\w*/i],
  ['Spills and hazardous materials', /\b(spill|oil|fuel|chemical|hazardous|lubricant)\w*/i],
  ['Soil and erosion', /\b(soil|erosion|topsoil|slope|landslide)\w*/i],
  ['Biodiversity', /\b(flora|fauna|habitat|vegetation|tree|wildlife|species|mangrove|coral|bird|biodiversity)\w*/i],
  ['Traffic and transport', /\b(traffic|vehicle|transport|road)\w*/i],
  ['Health and safety', /\b(safety|PPE|accident|health|fire)\b/i],
  ['Community and social', /\b(community|grievance|resettlement|livelihood|compensation|stakeholder|consultation|labour|worker)\w*/i],
  ['Cultural heritage', /\b(heritage|archaeolog|cultural|chance find)\w*/i],
  ['Climate and energy', /\b(greenhouse|GHG|carbon|climate|energy)\b/i],
]

/** Body of an EMP page without an ERM-style running title block. */
function body(p: Page): string {
  const i = p.text.search(/Final Report/i)
  return i >= 0 && i < 300 ? p.text.slice(i + 12) : p.text
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s)
const lastOwner = (s: string) => [...s.matchAll(OWNER)].at(-1)?.[1]?.replace(/^the\s+/i, '') ?? null

function item(fields: Omit<EmpItem, 'smart'>): EmpItem {
  return { ...fields, smart: [fields.owner, fields.hasNumber, fields.hasDate, fields.hasBudget].filter(Boolean).length }
}

/** ESMP tables with coded rows ("A.1 Activity … ■ measure ■ measure … Training: … Reporting"), as ERM writes them. */
function tableRows(emp: Page[]): EmpItem[] {
  // Rows run across pages, so read the chapter as one stream and remember where each page starts.
  let text = ''
  const offsets: { at: number; page: Page }[] = []
  for (const p of emp) {
    if (/Monitoring Programme|EMP Implementation Budget/i.test(p.text)) continue
    offsets.push({ at: text.length, page: p })
    text += body(p).replace(/^.*?Comment \/ Reference/, '') + ' '
  }
  if (!offsets.length) return []
  const pageAt = (i: number) => offsets.findLast((o) => o.at <= i)!.page

  const items: EmpItem[] = []
  const starts = [...text.matchAll(/\b([A-H])\.(\d{1,2})\s+(?=[A-Z])/g)]
  starts.forEach((m, k) => {
    const seg = text.slice(m.index, starts[k + 1]?.index ?? text.length).replace(/[◼•▪●]/g, '■')
    const bullet = seg.indexOf('■')
    if (bullet < 0) return // a heading or a cross-reference, not a row with measures
    const p = pageAt(m.index)
    const before = seg.split(/Training\s*:/i)[0]
    const after = seg.slice(before.length)
    items.push(item({
      id: `${m[1]}.${m[2]}-${p.index}-${k}`, // reports reuse codes (two C.3 rows on WCT-1 p. 9-10), so add the row order
      code: `${m[1]}.${m[2]}`,
      activity: clip(seg.slice(m[0].length, bullet).trim(), 90),
      promise: clip(before.slice(bullet + 1).split('■')[0].replace(/[;•]+\s*$/, '').trim(), 200),
      // The Responsible column sits just before Schedule/Training, so the last party named wins.
      owner: lastOwner(before),
      frequency: FREQ.exec(after)?.[1] ?? FREQ.exec(before)?.[1] ?? null,
      hasNumber: NUMBER.test(before),
      hasDate: TIMED.test(before),
      hasBudget: BUDGET.test(seg),
      training: /Training\s*:\s*None/i.test(seg) ? 'None' : /Training\s*:/i.test(seg) ? 'Listed' : 'Not stated',
      pdfPage: p.index,
      label: p.label,
    }))
  })
  return items
}

/** Any other layout: every commitment sentence or bullet in the EMP chapter becomes a ledger row. */
function commitmentSentences(emp: Page[], max = 150): EmpItem[] {
  const items: EmpItem[] = []
  const seen = new Set<string>()
  for (const p of emp) {
    if (isTocPage(p)) continue
    for (const raw of body(p).split(/(?<=[.;])\s+(?=[A-Z])|\s*[■◼•▪●]\s*|\s(?=\(?[a-z]\)\s|\d{1,2}\.\s[A-Z])/)) {
      const s = raw.replace(/^\(?[a-z0-9]{1,2}[.)]\s*/i, '').trim()
      if (s.length < 30 || s.length > 320 || !COMMIT.test(s) || /^(table|figure|source)\b/i.test(s)) continue
      const key = s.toLowerCase().slice(0, 70)
      if (seen.has(key)) continue
      seen.add(key)
      items.push(item({
        id: `S${items.length + 1}-${p.index}`,
        code: `S${items.length + 1}`,
        activity: TOPICS.find(([, re]) => re.test(s))?.[0] ?? 'General',
        promise: clip(s, 200),
        // Agencies are often named by acronym as the subject: "The MFARD will…", "CEB shall…".
        owner: lastOwner(s) ?? /^(?:The\s+)?([A-Z][A-Z&]{1,7})\s+(?:will|shall|must|should|is to|are to)\b/.exec(s)?.[1] ?? null,
        frequency: FREQ.exec(s)?.[1] ?? null,
        hasNumber: NUMBER.test(s),
        hasDate: TIMED.test(s),
        hasBudget: BUDGET.test(s),
        training: /\btrain(?:ing|ed)\b/i.test(s) ? 'Listed' : 'Not stated',
        pdfPage: p.index,
        label: p.label,
      }))
      if (items.length >= max) return items
    }
  }
  return items
}

/**
 * The EMP as a promise ledger. Coded ESMP tables are read row by row; any other layout falls back to its
 * commitment sentences. Monitoring-programme pages are skipped; they list checks, not promises.
 */
export function extractEmp(pages: Page[]): EmpItem[] {
  const emp = empPages(pages)
  const rows = tableRows(emp)
  return rows.length >= 5 ? rows : commitmentSentences(emp)
}

const PARAMETERS: [string, RegExp, string][] = [
  ['TSS', /total suspended solids|suspended solids|\bTSS\b/i, 'mg/l'],
  ['Turbidity', /turbidity/i, 'NTU'],
  ['PM2.5', /PM\s?2\.5/i, 'µg/m³'],
  ['PM10', /PM\s?10/i, 'µg/m³'],
  ['NO₂', /\bNO2\b|nitrogen dioxide/i, 'µg/m³'],
  ['SO₂', /\bSO2\b|sulphur dioxide|sulfur dioxide/i, 'µg/m³'],
  ['Noise', /noise|\bdB\s?\(?A/i, 'dB(A)'],
  ['BOD', /\bBOD\b|biochemical oxygen/i, 'mg/l'],
  ['COD', /\bCOD\b|chemical oxygen/i, 'mg/l'],
  ['Dissolved oxygen', /dissolved oxygen|\bDO\b/i, 'mg/l'],
  ['Oil and grease', /oil (?:and|&) grease/i, 'mg/l'],
]

/** Longest station-by-station series that sits against a stated limit, named after its parameter. */
export function monitoringSeries(pages: Page[]): MonitoringSeries | null {
  let best: MonitoringSeries | null = null
  for (const page of pages) {
    const { rows } = parseLimitTable(page)
    const byLimit = new Map<number, { code: string; value: number; at: number }[]>()
    for (const r of rows) byLimit.set(r.limit, [...(byLimit.get(r.limit) ?? []), { code: r.code, value: r.value, at: r.at }])
    for (const [limit, cells] of byLimit) {
      const values = cells.map(({ code, value }) => ({ code, value }))
      if (values.length >= 5 && (!best || values.length > best.values.length)) {
        // The parameter named last before the table is the one being measured.
        const lead = page.text.slice(0, page.text.indexOf(values[0].code) + 1 || undefined).slice(-700)
        const hit = PARAMETERS.map(([name, re, unit]) => ({ name, unit, at: lead.search(new RegExp(re.source, 'gi')) >= 0 ? lead.lastIndexOf(lead.match(re)![0]) : -1 }))
          .filter((h) => h.at >= 0).sort((a, b) => b.at - a.at)[0]
        const quote = quoteAround(page.text, cells[0].at, cells[0].at + 24, 20)
        best = { name: hit?.name ?? 'Measured value', unit: hit?.unit ?? '', limit, values, quote, pdfPage: page.index, label: page.label }
      }
    }
  }
  return best
}
