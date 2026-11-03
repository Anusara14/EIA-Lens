import type { Evidence, Finding, Page } from './types'
import { BUDGET, COST_HEADER, empPages, evidenceFrom, findAll, isReferencePage, monthIndex, quoteAround, toEvidence, windowAt } from './text'

type Rule = (pages: Page[]) => Finding

// Predictive models seen in EIAs worldwide: air, noise, hydrodynamics, water quality, groundwater, coastal, traffic, wind.
// Case-sensitive on purpose: "GENESIS", "MOVES" and "SWAN" are models; "genesis", "moves" and "swan" are words.
const MODELS = /\b(AERMOD|AERMET|AERSCREEN|SCREEN3|ISCST3|CALPUFF|CALINE\d?|CAL3QHCR?|ADMS(?:-Roads|-Urban)?|CMAQ|WRF-Chem|Sound ?PLAN|SoundPlan|Cadna ?A|IMMI|Predictor-LimA|ISO\s?9613|CRTN|TNM|MIKE\s?(?:21|3|11|SHE|FM)|Mike\s?21|Delft ?3D|TELEMAC|Telemac|ROMS|FVCOM|EFDC|SWAN|XBeach|GENESIS|LITPACK|CORMIX|Visual Plumes|QUAL2[EK]|WASP\d?|HEC-RAS|HEC-HMS|SWMM|SWAT|MODFLOW|FEFLOW|PHABSIM|WAsP|WindPRO|WindPro|openwind|MOVES\d*|COPERT|VISSIM|PVsyst)\b/g
const AIR_MODEL = /\b(AERMOD|AERMET|AERSCREEN|SCREEN3|ISCST3|CALPUFF|CALINE\d?|CAL3QHCR?|ADMS|CMAQ)\b/i

function base(ruleId: string, title: string, section: Finding['section'], severity: Finding['severity'], fix: string) {
  return { ruleId, title, section, severity, fix }
}

function na(b: ReturnType<typeof base>, why: string): Finding {
  return { ...b, status: 'na', explanation: why, evidence: [] }
}

// R1 — meteorological input must cover at least a full year of seasons
const r1: Rule = (pages) => {
  const b = base('R1', 'Meteorological data covers ≥ 1 year', 'B', 'High',
    'Re-run the dispersion model with a full year (ideally 3–5 years) of site-representative met data, covering both monsoons.')
  const airPages = pages.filter((p) => AIR_MODEL.test(p.text))
  if (!airPages.length) return na(b, 'No air dispersion model found in the report.')

  const short: Evidence[] = []
  for (const h of findAll(airPages, /one season/i)) short.push(toEvidence(h))
  const range = /from\s+(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s+to\s+(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/gi
  for (const h of findAll(airPages, /meteorolog\w*|met input/i)) {
    const page = airPages.find((p) => p.index === h.pdfPage)!
    for (const m of windowAt(page.text, h.index, 300).matchAll(range)) {
      const months = (+m[6] - +m[3]) * 12 + (monthIndex(m[5]) - monthIndex(m[2])) + 1
      if (months > 0 && months < 12 && !short.some((e) => e.pdfPage === h.pdfPage)) short.push(toEvidence(h))
    }
    for (const m of windowAt(page.text, h.index, 300).matchAll(/(\d+)\s+months?/gi)) {
      if (+m[1] < 12 && !short.some((e) => e.pdfPage === h.pdfPage)) short.push(toEvidence(h))
    }
  }
  if (short.length)
    return { ...b, status: 'flag', evidence: short.slice(0, 3),
      explanation: 'The air model was driven by less than a year of weather data, so seasonal worst cases (e.g. the other monsoon) are missing.' }
  return { ...b, status: 'pass', evidence: evidenceFrom(findAll(airPages, /meteorolog\w* data/i), 1),
    explanation: 'No sign of a sub-annual met record for the air model.' }
}

// R2 — rural dispersion coefficients need a land-use justification
const r2: Rule = (pages) => {
  const b = base('R2', 'Dispersion setting justified', 'B', 'Medium',
    'Justify rural vs urban dispersion with an Auer land-use analysis within 3 km; a port inside Colombo city is normally urban.')
  const hits = findAll(pages, /Dispersion Coefficient\s*:?\s*(Rural|Urban)/i)
  if (!hits.length) return na(b, 'No dispersion-coefficient setting reported.')
  const rural = hits.filter((h) => /rural/i.test(h.match))
  const unjustified = rural.filter((h) => {
    const page = pages.find((p) => p.index === h.pdfPage)!
    return !/land.use|Auer/i.test(windowAt(page.text, h.index, 1500))
  })
  if (unjustified.length)
    return { ...b, status: 'flag', evidence: evidenceFrom(unjustified),
      explanation: 'The model uses "Rural" dispersion without any land-use justification. Rural settings usually under-predict concentrations in a city.' }
  return { ...b, status: 'pass', evidence: evidenceFrom(hits, 1), explanation: 'The dispersion setting is reported with a justification nearby.' }
}

// R3 — each named model needs calibration or validation evidence
const r3: Rule = (pages) => {
  const b = base('R3', 'Model calibration / validation reported', 'B', 'High',
    'Calibrate each model against site measurements (e.g. plume model vs field TSS, AERMOD vs monitored baseline) and report the error statistics.')
  const hits = findAll(pages.filter((p) => !isReferencePage(p)), MODELS)
  if (!hits.length) return na(b, 'No named predictive model found.')
  const byModel = new Map<string, typeof hits>()
  for (const h of hits) {
    const k = h.match.toUpperCase().replace(/\s/g, '')
    byModel.set(k, [...(byModel.get(k) ?? []), h])
  }
  const missing: Evidence[] = []
  const names: string[] = []
  for (const [name, hs] of byModel) {
    const ok = hs.some((h) => {
      const page = pages.find((p) => p.index === h.pdfPage)!
      return /calibrat|validat/i.test(windowAt(page.text, h.index, 500))
    })
    if (!ok) { names.push(name); missing.push(toEvidence(hs[0])) }
  }
  if (missing.length)
    return { ...b, status: 'flag', evidence: missing.slice(0, 3),
      explanation: `No calibration or validation is reported for ${names.join(', ')}. Predictions cannot be trusted without a check against measured data.` }
  return { ...b, status: 'pass', evidence: evidenceFrom(hits, 1), explanation: 'Every named model has calibration or validation text nearby.' }
}

// R4 — sensitivity / uncertainty analysis
const r4: Rule = (pages) => {
  const b = base('R4', 'Sensitivity / uncertainty analysis', 'B', 'Medium',
    'Add a sensitivity run for the key inputs (emission rate, met year, sediment loss rate) and state a range, not a single number.')
  const models = findAll(pages.filter((p) => !isReferencePage(p)), MODELS)
  if (!models.length) return na(b, 'No predictive model found.')
  const hits = findAll(pages, /sensitivity analys[ie]s|uncertaint(y|ies)|confidence interval/i)
  if (hits.length) return { ...b, status: 'pass', evidence: evidenceFrom(hits, 2), explanation: 'The report discusses sensitivity or uncertainty.' }
  return { ...b, status: 'flag', evidence: evidenceFrom(models, 2),
    explanation: 'Model results are given as single values. The report never discusses sensitivity, uncertainty or confidence ranges.' }
}

// R5 — forward-looking climate scenarios
const r5: Rule = (pages) => {
  const b = base('R5', 'Climate scenarios considered', 'B', 'High',
    'Test coastal structures and drainage against SSP2-4.5 and SSP5-8.5 sea-level and storm-surge projections (IPCC AR6) over the asset life.')
  const hits = findAll(pages, /\bSSP\s?\d|\bRCP\s?\d|\bIPCC\b|sea.level rise|climate projection/i)
  if (hits.length) return { ...b, status: 'pass', evidence: evidenceFrom(hits, 2), explanation: 'Future climate scenarios are referenced.' }
  const ctx = findAll(pages, /storm surge|climate change resilience|tsunami|flood(ing)? (risk|hazard)|cyclone/i)
  return { ...b, status: 'flag', evidence: evidenceFrom(ctx, 2),
    explanation: ctx.length
      ? 'Climate risks are judged from past events only. No SSP/RCP scenario, IPCC projection or sea-level rise is considered.'
      : 'The report never considers future climate: no SSP/RCP scenario, IPCC projection or sea-level rise appears anywhere.' }
}

interface Exceedance { code: string; value: number; limit: number; ratio: number; page: Page; at: number }

const NOT_STATION = /^(NO|SO|CO|PM|O|CH|NH|H)[-_ ]?\d+$/i

/** Parse "CODE n n n" rows on a page against a "... standard|limit n n n" row. */
export function parseLimitTable(page: Page): { rows: Exceedance[]; columns: number[][] } {
  const lim = /(?:standards?|limits?|guidelines?|guideline values?|threshold|permissible(?: level)?|NAAQS|criteria)\s+((?:<?\d+(?:\.\d+)?\*{0,2}(?:\s+|$)){1,6})/i.exec(page.text)
  // Only measurement tables: risk matrices and scoring tables also sit next to "Guidelines" but carry no units.
  if (!lim || !/mg\/|µg|ug\/|dB|NTU|ppm|ppb|°C|concentration|monitor(?:ing|ed)|baseline|sampl/i.test(page.text)) return { rows: [], columns: [] }
  const limits = lim[1].trim().split(/\s+/).map((s) => (s.startsWith('<') ? NaN : parseFloat(s)))
  const n = limits.length
  const rows: Exceedance[] = []
  const columns: number[][] = limits.map(() => [])
  const rowRe = new RegExp(String.raw`\b([A-Z]{1,4}[-_ ]?\d{1,2})\s+((?:<?\d+(?:\.\d+)?(?:\s+|$)){${n}})`, 'g')
  for (const m of page.text.matchAll(rowRe)) {
    if (NOT_STATION.test(m[1]) || (m.index ?? 0) > lim.index) continue
    m[2].trim().split(/\s+/).forEach((s, j) => {
      if (s.startsWith('<') || Number.isNaN(limits[j])) return
      const v = parseFloat(s)
      columns[j].push(v)
      rows.push({ code: m[1], value: v, limit: limits[j], ratio: v / limits[j], page, at: m.index ?? 0 })
    })
  }
  return { rows, columns }
}

// R6 — baseline already close to (or over) its standard
const r6: Rule = (pages) => {
  const b = base('R6', 'Baseline headroom ≥ 10%', 'B', 'High',
    'Where baseline is within 10% of a limit, treat the receptor as saturated: add a stop-work trigger and model the cumulative case explicitly.')
  const near: Evidence[] = []
  const notes: string[] = []
  for (const page of pages) {
    const { rows } = parseLimitTable(page)
    const hot = rows.filter((r) => r.ratio >= 0.9 && r.ratio < 3)
    if (hot.length) {
      const worst = hot.reduce((a, r) => (r.ratio > a.ratio ? r : a))
      near.push({ quote: quoteAround(page.text, worst.at, worst.at + 40), pdfPage: page.index, label: page.label })
      notes.push(`${hot.length} value${hot.length > 1 ? 's' : ''} ≥ 90% of limit on p. ${page.label ?? page.index} (worst ${worst.code}: ${worst.value} vs ${worst.limit})`)
    }
  }
  for (const h of findAll(pages, /ranged from (\d+(?:\.\d+)?) to (\d+(?:\.\d+)?)[^.]{0,80}?limit of (\d+(?:\.\d+)?)/i)) {
    const m = /to (\d+(?:\.\d+)?)[^.]{0,80}?limit of (\d+(?:\.\d+)?)/i.exec(h.match)!
    if (+m[1] / +m[2] >= 0.9 && !near.some((e) => e.pdfPage === h.pdfPage)) near.push(toEvidence(h))
  }
  if (!near.length) return { ...b, status: 'pass', evidence: [], needsConfirmation: true,
    explanation: 'No baseline value within 10% of its limit was found in parsed tables. Tables a regex cannot read still need checking.' }
  return { ...b, status: 'flag', evidence: near.slice(0, 4), needsConfirmation: true,
    explanation: `Baseline is already at or above the limit, so the project has little or no headroom. ${notes.slice(0, 2).join('; ')}.` }
}

// R7 — baseline averaging period differs from the standard's
const r7: Rule = (pages) => {
  const b = base('R7', 'Averaging time consistent', 'B', 'Medium',
    'Compare like with like: 1-hour standards need 1-hour maxima (AERMOD 1st-high), 24-hour standards need 24-hour values.')
  const both = pages.filter((p) => /24[- ]?hour(ly)?|24 hrs/i.test(p.text) && /\b1[- ]?hour(ly)?\b/i.test(p.text) && /standard|limit/i.test(p.text) && /baseline/i.test(p.text))
  if (!both.length) return { ...b, status: 'pass', evidence: [], explanation: 'No table mixing 24-hour values with 1-hour standards was found.' }
  return { ...b, status: 'flag', evidence: evidenceFrom(findAll(both, /\b1[- ]?hourly\b/i), 2),
    explanation: '24-hour baseline values are compared with 1-hour standards in the same table. That mixes averaging periods and makes the comparison invalid.' }
}

// R8 — the same input stated differently in different places
const r8: Rule = (pages) => {
  const b = base('R8', 'Text and tables agree', 'B', 'Medium',
    'Reconcile the conflicting inputs, say which value the model actually used, and re-run if needed.')
  const ev: Evidence[] = []
  const notes: string[] = []

  const airPages = pages.filter((p) => AIR_MODEL.test(p.text))
  const years = new Map<string, Evidence>()
  for (const h of findAll(airPages, /meteorolog\w* data|met input/i)) {
    const page = airPages.find((p) => p.index === h.pdfPage)!
    for (const y of page.text.slice(h.index, h.index + 250).match(/\b(?:19|20)\d\d\b/g) ?? []) if (!years.has(y)) years.set(y, toEvidence(h))
  }
  if (years.size > 1) { notes.push(`met data year given as ${[...years.keys()].join(' and ')}`); ev.push(...years.values()) }

  const cycles = new Map<string, Evidence>()
  for (const h of findAll(pages, /cycle (?:is|of)?\s*(\d{2,4})\s?min/i)) {
    const v = /(\d{2,4})\s?min/.exec(h.match)![1]
    if (!cycles.has(v)) cycles.set(v, toEvidence(h))
  }
  if (cycles.size > 1) { notes.push(`dredging cycle given as ${[...cycles.keys()].join(' and ')} min`); ev.push(...cycles.values()) }

  for (const h of findAll(pages, /ranged from (\d+(?:\.\d+)?) to (\d+(?:\.\d+)?)/i)) {
    const [, lo, hi] = /from (\d+(?:\.\d+)?) to (\d+(?:\.\d+)?)/.exec(h.match)!
    const page = pages.find((p) => p.index === h.pdfPage)!
    for (const col of parseLimitTable(page).columns) {
      if (col.length > 3 && Math.min(...col) === +lo && Math.max(...col) !== +hi) {
        notes.push(`text says ${lo}–${hi} but the table on the same page reaches ${Math.max(...col)}`)
        ev.push(toEvidence(h))
      }
    }
  }
  if (!ev.length) return { ...b, status: 'pass', evidence: [], needsConfirmation: true, explanation: 'No conflicting values were detected for the inputs checked.' }
  return { ...b, status: 'flag', evidence: ev.slice(0, 4), needsConfirmation: true,
    explanation: `The report contradicts itself: ${notes.join('; ')}.` }
}

// R9 — draft or placeholder text left in a final report
const r9: Rule = (pages) => {
  const b = base('R9', 'No placeholder or draft text', 'A', 'Medium',
    'Complete the missing assessment (or state that it was not done and why) before the report is accepted as final.')
  // A bare "xx" is usually a roman page number in front matter, so only count it where a number belongs.
  // Includes Word's broken-cross-reference text, which survives into many final PDFs.
  const hits = findAll(pages, /to provide their assessment|before any finali[sz]ation|\bTBD\b|\bTBC\b|to be confirmed\b|\[insert|\[to be|\[add |\[placeholder|insert (?:figure|table|map) here|Error! (?:Reference source not found|Bookmark not defined)|\b(Table|Figure|Fig\.|Section|Annex|Appendix|Chapter|page)\s+x{2,}\b|\bx{2,}\s?(%|km|m\b|mg)|lorem ipsum|\?\?\?/i)
  if (!hits.length) return { ...b, status: 'pass', evidence: [], explanation: 'No placeholder text found.' }
  return { ...b, status: 'flag', evidence: evidenceFrom(hits, 3),
    explanation: `${hits.length} placeholder${hits.length > 1 ? 's' : ''} left in the final report: part of the assessment was never done.` }
}

const HEDGE = /\bshould\b|as much as possible|if possible|wherever possible|\bexplore\b|as far as practicable/gi

// R10 — EMP commitments must be specific, measurable and costed
const r10: Rule = (pages) => {
  const b = base('R10', 'EMP commitments are SMART', 'C', 'High',
    'Rewrite each EMP item as "who does what, by when, measured how, at what cost" and give the EMP a line-item budget.')
  const emp = empPages(pages)
  if (!emp.length) return na(b, 'No environmental management plan chapter found.')

  const hedges = findAll(emp, HEDGE, 60)
  const noTraining = findAll(emp, /Training:\s*None/i, 60)
  const budgets = findAll(emp, /\bbudget\b|estimated cost|cost estimate|\bcosts?\s*\(|cost of (?:the )?(?:E?S?MM?P|mitigation|monitoring)/i)
  const costed = budgets.filter((h) => {
    const page = emp.find((p) => p.index === h.pdfPage)!
    const near = windowAt(page.text, h.index, 400)
    // A money figure nearby, or a cost table whose header carries the currency ("Estimated Cost (LKR) in Million").
    return BUDGET.test(near) || COST_HEADER.test(near)
  })
  const noFigure = !costed.length
  const uncosted = budgets.filter((h) => !costed.includes(h)).sort((a, b) => +/allocate/i.test(b.quote) - +/allocate/i.test(a.quote))
  const issues: string[] = []
  if (noFigure) issues.push(budgets.length ? 'the budget section gives no figure' : 'there is no budget section')
  // Scaled to EMP length so a long, thorough EMP is not penalised for its size alone.
  const hedgy = hedges.length > 10 && hedges.length / emp.length >= 0.5
  if (hedgy) issues.push(`"should"-type hedges appear ${hedges.length} times`)
  if (noTraining.length) issues.push(`${noTraining.length} items say "Training: None"`)

  if (!noFigure && !hedgy)
    return { ...b, status: 'pass', evidence: evidenceFrom(costed, 1), explanation: 'The EMP is costed and mostly uses firm commitments.' }
  return { ...b, status: 'flag', evidence: [...evidenceFrom(uncosted, 1), ...evidenceFrom(noTraining, 1), ...evidenceFrom(hedges, 1)],
    explanation: `The EMP cannot be enforced as written: ${issues.join('; ')}.` }
}

export const RULES: Rule[] = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10]

export function runRules(pages: Page[]): Finding[] {
  return RULES.map((r) => r(pages))
}
