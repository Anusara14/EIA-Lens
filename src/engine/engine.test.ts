import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { extractPages } from '../pdf/extract'
import { findQuoteItems } from '../pdf/highlight'
import { analyse } from './index'
import seed from '../demo/wct1.json'

const PDF = new URL('../../public/demo/WCT1_ESIA_2023.pdf', import.meta.url)

describe('WCT-1 ESIA (ground truth: expert review)', async () => {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(PDF)), useSystemFonts: true }).promise
  const pages = await extractPages(doc)
  const a = analyse(pages)
  const byId = Object.fromEntries(a.findings.map((f) => [f.ruleId, f]))

  it('maps most PDF pages to printed ESIA labels', () => {
    expect(a.labelledPages).toBeGreaterThan(280)
    expect(pages.find((p) => p.label === '7-62')).toBeTruthy()
  })

  it.each(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10'])('%s flags', (id) => {
    expect(byId[id].status).toBe('flag')
    expect(byId[id].evidence.length).toBeGreaterThan(0)
  })

  it('puts the key evidence on the expected pages', () => {
    expect(byId.R1.evidence.map((e) => e.label)).toContain('7-62')
    expect(byId.R9.evidence.map((e) => e.label)).toContain('7-82')
    expect(byId.R10.evidence.map((e) => e.label)).toContain('9-36')
    expect(byId.R6.evidence.map((e) => e.label)).toEqual(expect.arrayContaining(['7-64', '9-34']))
  })

  it('maps every evidence quote back to text items on its PDF page (for highlighting)', async () => {
    for (const f of a.findings) {
      for (const ev of f.evidence) {
        const { items } = await (await doc.getPage(ev.pdfPage)).getTextContent()
        const hit = findQuoteItems(items.filter((i) => 'str' in i) as { str: string }[], ev.quote)
        expect(hit.length, `${f.ruleId} p.${ev.label}`).toBeGreaterThan(0)
      }
    }
  })

  it('builds the EMP promise ledger and the TSS series', () => {
    expect(a.emp.length).toBeGreaterThan(30)
    expect(a.emp.filter((e) => e.training === 'None').length).toBeGreaterThanOrEqual(10)
    expect(a.emp.every((e) => !e.hasBudget)).toBe(true)
    expect(a.monitoring?.label).toBe('9-34')
    expect(a.monitoring?.limit).toBe(150)
    expect(a.monitoring?.values.map((v) => v.value)).toEqual(seed.tss)
  })

  it('scores WCT-1 as Poor / Revise', () => {
    expect(a.ratings.model).toBe('Poor')
    expect(a.ratings.review).toBe('Poor')
    expect(a.decision).toBe('Revise')
    expect(a.auditability.score).toBeLessThan(0.5)
  })
})

describe('table parsing', () => {
  it('catches text vs table conflict on TSS (text says 146, table reaches 148)', () => {
    const page = { index: 1, label: '9-34', text: 'The suspended solids level ranged from 114 to 146 m/l, which is within the MEPA limit of 150 mg/l. WS1 <1 146 WS2 <1 148 WS3 <1 120 WS4 <1 114 WS5 <1 130 MEPA Limit <1 150' }
    const r8 = analyse([page]).findings.find((f) => f.ruleId === 'R8')!
    expect(r8.status).toBe('flag')
    expect(r8.explanation).toContain('148')
  })
})
