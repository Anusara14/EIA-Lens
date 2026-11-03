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

  it('locates the project from coordinates in the report', () => {
    expect(a.location.source).toBe('coordinates')
    const [lng, lat] = a.location.center!
    expect(lat).toBeCloseTo(6.95, 1) // Colombo Port
    expect(lng).toBeCloseTo(79.83, 1)
    expect(a.location.points.some((p) => p.lat > 7.1)).toBe(true) // sand borrow samples off Kerawalapitiya
    expect(a.location.radius?.km).toBe(5)
  })

  it('scores WCT-1 as Poor / Revise', () => {
    expect(a.ratings.model).toBe('Poor')
    expect(a.ratings.review).toBe('Poor')
    expect(a.decision).toBe('Revise')
    expect(a.auditability.score).toBeLessThan(0.5)
  })
})

describe('location fallbacks', () => {
  const page = (text: string, index = 1) => ({ index, label: null, text })
  it('reads inline DMS, even with a wrong hemisphere letter on longitude', () => {
    const loc = analyse([page('The location of the project is 9°49\'43.43"N and 80°14\'8.36"E. WQ1 8°31\'45.95" 81° 8\'59.16" S')]).location
    expect(loc.points.map((p) => [p.lat.toFixed(3), p.lng.toFixed(3)])).toEqual([['9.829', '80.236'], ['8.529', '81.150']])
  })
  it('handles southern and western hemispheres', () => {
    const [p] = analyse([page('Site coordinates: 23°33\'01"S 46°38\'02"W (Sao Paulo).')]).location.points
    expect(p.lat).toBeCloseTo(-23.55, 2)
    expect(p.lng).toBeCloseTo(-46.634, 2)
  })
  it('converts UTM grid references using the stated zone', () => {
    const loc = analyse([page('Coordinates are WGS 84 / UTM Zone 37M. Plant boundary 257000 mE, 9858000 mN.')]).location
    expect(loc.points[0].lat).toBeCloseTo(-1.284, 2) // Nairobi
    expect(loc.points[0].lng).toBeCloseTo(36.816, 2)
  })
  it('places reports anywhere in the world by name, inside the named country', () => {
    const loc = analyse([page('Environmental and Social Impact Assessment: Mombasa Port Expansion, Kenya'), page('The berth lies in Mombasa, Kenya.', 2)]).location
    expect(loc.place?.name).toBe('Mombasa')
    expect(loc.place?.country).toBe('Kenya')
  })
  it('falls back to the country when no town is recognised', () => {
    const loc = analyse([page('ESIA for a utility-scale solar plant in Namibia'), page('Namibia grid code applies. Namibia.', 2)]).location
    expect(loc.place?.name).toBe('Namibia (country only)')
    expect(loc.place?.uncertaintyKm).toBe(100)
  })
  it('falls back to the most-mentioned place, weighting the title page', () => {
    const loc = analyse([page('EIA for wind power project, Mannar Island'), page('Consultants, Kotte. Mannar Mannar.', 2)]).location
    expect(loc.source).toBe('place')
    expect(loc.place?.name).toBe('Mannar')
  })
})

describe('any report layout', () => {
  const page = (text: string, index = 1) => ({ index, label: null, text })
  const emp = [
    page('7 ENVIRONMENTAL AND SOCIAL MANAGEMENT PLAN 7.1 Mitigation measures. The Contractor shall water haul roads twice daily to suppress dust. Noise from piling should be limited where possible. The EHS Officer will inspect waste storage weekly. Monitoring responsibilities and frequency are set out below.', 10),
    page('Implementation of the ESMP. The Developer will appoint a Community Liaison Officer prior to construction. ESMP budget: EUR 1,250,000 for mitigation and monitoring. Contractor responsibilities include monitoring of spills.', 11),
    page('8 CONCLUSIONS The project is acceptable subject to the ESMP.', 12),
  ]
  it('finds the ESMP chapter by its heading and reads commitment sentences', () => {
    const a = analyse(emp)
    expect(a.emp.length).toBeGreaterThanOrEqual(4)
    const dust = a.emp.find((e) => /haul roads/.test(e.promise))!
    expect(dust.owner).toMatch(/Contractor/)
    expect(dust.frequency).toBe('daily')
    expect(dust.activity).toBe('Air quality and dust')
    expect(a.emp.every((e) => e.pdfPage !== 12)).toBe(true) // stops at the next chapter
  })
  it('accepts a costed EMP in any currency', () => {
    expect(analyse(emp).findings.find((f) => f.ruleId === 'R10')!.status).toBe('pass')
  })
  it('flags Word broken cross-references as draft text', () => {
    const r9 = analyse([page('Noise contours are shown in Error! Reference source not found. below.')]).findings.find((f) => f.ruleId === 'R9')!
    expect(r9.status).toBe('flag')
  })
  it('reads monitoring tables against guideline values and names the parameter', () => {
    const t = 'Table 5.3 Baseline PM10 (µg/m³) 24-hour AQ-1 41 AQ-2 47 AQ-3 44 AQ-4 39 AQ-5 46 WHO guideline 45'
    const a = analyse([page(t)])
    expect(a.monitoring?.name).toBe('PM10')
    expect(a.monitoring?.limit).toBe(45)
    expect(a.findings.find((f) => f.ruleId === 'R6')!.status).toBe('flag') // AQ-2 and AQ-5 above 90% of the guideline
  })
  it('notices scanned pages and non-English reports', () => {
    const scanned = analyse([page(''), page(' ', 2), page('Executive summary. '.repeat(20), 3)]).coverage
    expect(scanned.scannedShare).toBeCloseTo(2 / 3, 2)
    const spanish = analyse([page('El proyecto se ubica en la zona costera. '.repeat(30))]).coverage
    expect(spanish.english).toBe(false)
    expect(analyse(emp).coverage.english).toBe(true)
  })
  it('names models used outside Sri Lanka', () => {
    const r3 = analyse([page('Noise was predicted with SoundPLAN 8.2 using ISO 9613-2 propagation.')]).findings.find((f) => f.ruleId === 'R3')!
    expect(r3.status).toBe('flag')
    expect(r3.explanation).toMatch(/SOUNDPLAN/)
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
