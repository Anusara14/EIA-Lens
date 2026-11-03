import type { Evidence, Page } from './types'

export interface Hit extends Evidence {
  index: number // char offset within page text
  match: string
}

const QUOTE_PAD = 110

/** Cut a readable quote around a match, snapped to word boundaries. */
export function quoteAround(text: string, start: number, end: number, pad = QUOTE_PAD): string {
  let a = Math.max(0, start - pad)
  let b = Math.min(text.length, end + pad)
  if (a > 0) a = text.indexOf(' ', a) + 1 || a
  if (b < text.length) b = text.lastIndexOf(' ', b) > end ? text.lastIndexOf(' ', b) : b
  return (a > 0 ? '… ' : '') + text.slice(a, b).trim() + (b < text.length ? ' …' : '')
}

/** Table-of-contents pages are full of headings and dot leaders; skip them for evidence. */
export function isTocPage(p: Page): boolean {
  return (p.text.match(/\.{8,}/g) ?? []).length > 4
}

export function findAll(pages: Page[], re: RegExp, pad = QUOTE_PAD): Hit[] {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g'
  const g = new RegExp(re.source, flags)
  const hits: Hit[] = []
  for (const p of pages) {
    if (isTocPage(p)) continue
    for (const m of p.text.matchAll(g)) {
      const i = m.index ?? 0
      hits.push({
        quote: quoteAround(p.text, i, i + m[0].length, pad),
        pdfPage: p.index,
        label: p.label,
        index: i,
        match: m[0],
      })
    }
  }
  return hits
}

/** Text window around an offset, for "is X mentioned near Y" checks. */
export function windowAt(text: string, index: number, radius: number): string {
  return text.slice(Math.max(0, index - radius), index + radius)
}

export function toEvidence(h: Hit): Evidence {
  return { quote: h.quote, pdfPage: h.pdfPage, label: h.label }
}

/** One evidence item per page, capped, so a 94-hit keyword does not flood the list. */
export function evidenceFrom(hits: Hit[], max = 3): Evidence[] {
  const seen = new Set<number>()
  const out: Evidence[] = []
  for (const h of hits) {
    if (seen.has(h.pdfPage)) continue
    seen.add(h.pdfPage)
    out.push(toEvidence(h))
    if (out.length >= max) break
  }
  return out
}

/** Running section header that follows the report title on each page (e.g. "IMPACT ASSESSMENT"). */
export function pagesUnderHeader(pages: Page[], header: RegExp): Page[] {
  return pages.filter((p) => {
    const i = p.text.search(/Final Report/i)
    const head = i >= 0 ? p.text.slice(i + 'Final Report'.length, i + 90).trim() : p.text.slice(0, 400)
    return header.test(head)
  })
}

const CHAPTER_END = /^\s*(?:(?:chapter|section)\s+)?(?:\d{1,2}(?:\.0)?\.?\s+)?(REFERENCES|BIBLIOGRAPHY|ANNEX(?:URE)?S?|APPENDI(?:X|CES)|CONCLUSIONS?(?: AND RECOMMENDATIONS)?|RECOMMENDATIONS)\b/
const CHAPTER_HEAD = /^\s*(?:(?:chapter|section)\s+)?(\d{1,2})(?:\.0)?\.?\s+[A-Z][A-Za-z&,/ -]{6,60}\b/

/**
 * Pages of one report chapter, for any layout: ERM-style running headers first; otherwise the page whose
 * top carries the chapter title, up to the next numbered chapter or annex; otherwise the pages densest
 * in the chapter's vocabulary.
 */
export function chapterPages(pages: Page[], opts: { header: RegExp; title: RegExp; vocab: RegExp; minVocab: number }): Page[] {
  const byHeader = pagesUnderHeader(pages, opts.header)
  if (byHeader.length >= 3) return byHeader

  const body = pages.filter((p) => !isTocPage(p))
  const top = (p: Page) => {
    const i = p.text.search(/Final Report/i) // skip a running report title if there is one
    return (i >= 0 && i < 300 ? p.text.slice(i + 12) : p.text).slice(0, 320)
  }
  const vocab = (p: Page) => (p.text.match(new RegExp(opts.vocab.source, 'gi')) ?? []).length
  const starts = body.map((p, i) => ({ p, i })).filter(({ p }) => opts.title.test(top(p)))
  let best: Page[] = []
  let bestScore = 0
  for (const { p, i } of starts) {
    const chapterNo = CHAPTER_HEAD.exec(top(p))?.[1]
    const span: Page[] = [p]
    for (let j = i + 1; j < body.length && span.length < 80; j++) {
      const head = top(body[j])
      const next = CHAPTER_HEAD.exec(head)?.[1]
      if (CHAPTER_END.test(head) || (chapterNo && next && next !== chapterNo && !opts.title.test(head))) break
      span.push(body[j])
    }
    const score = span.reduce((s, q) => s + vocab(q), 0) / Math.sqrt(span.length)
    if (score > bestScore) [best, bestScore] = [span, score]
  }
  if (best.length >= 2) return best
  return body.filter((p) => vocab(p) >= opts.minVocab)
}

const EMP_TITLE = /\b(?:environment(?:al)?\s+(?:and|&)\s+social\s+management(?:\s+(?:and|&)\s+monitoring)?\s+plan|environment(?:al)?\s+management(?:\s+(?:and|&)\s+monitoring)?\s+(?:plan|programme|program|framework)|E?S?MM?P\b|mitigation\s+(?:and|&)\s+monitoring\s+plan)/i

/** The environmental (and social) management plan chapter, whatever the report calls it. */
export function empPages(pages: Page[]): Page[] {
  return chapterPages(pages, {
    header: /^(ENVIRONMENT\w*\s+(AND|&)\s+SOCIAL\s+)?MANAGEMENT PLAN/i,
    title: EMP_TITLE,
    vocab: /\bmitigation\b|\bmonitor(?:ing)?\b|responsib\w*|\bfrequency\b|\bE?S?MM?P\b|\bcontractors?\b|implementation/,
    minVocab: 6,
  })
}

/** The impact assessment / prediction chapter. */
export function impactPages(pages: Page[]): Page[] {
  return chapterPages(pages, {
    header: /^IMPACT ASSESSMENT/i,
    title: /\b(?:impact\s+(?:assessment|identification|prediction|evaluation|analysis)|(?:anticipated|potential|predicted)\s+(?:environmental\s+)?impacts|assessment\s+of\s+(?:environmental\s+)?impacts|environmental\s+effects)\b/i,
    vocab: /\bimpacts?\b|\bsignifican\w+|\bmagnitude\b|\bsensitivit\w+|\bpredict\w*/,
    minVocab: 8,
  })
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase())
}

/**
 * A money figure in any common currency (USD 650, € 2.5, KES 40,000, ₹ 12 crore). Word-bounded so
 * "years 2" is not read as "Rs 2"; the lone South African "R" is left out because it collides with road and rule names.
 */
export const BUDGET = /(?:\b(?:USD|EUR|GBP|INR|LKR|SLR|PKR|BDT|NPR|KES|Ksh|TZS|UGX|RWF|NGN|GHS|ZAR|ETB|EGP|MAD|XOF|XAF|AUD|NZD|CAD|CNY|RMB|JPY|KRW|IDR|PHP|VND|MYR|THB|BRL|MXN|COP|PEN|CLP|ARS|Rs|Rp)\.?|US\$|A\$|C\$|[$€£₹¥₦₱₫฿])\s?\d[\d,.]*/
/** Header of a cost table, e.g. "Estimated Cost (LKR) in Million", "Budget (USD)". */
export const COST_HEADER = /(?:cost|budget|amount)\s*\(\s*(?:USD|EUR|GBP|INR|LKR|SLR|PKR|BDT|KES|NGN|ZAR|AUD|CAD|CNY|IDR|PHP|VND|BRL|MXN|Rs\.?|US\$|[$€£₹])[^)]*\)[^.]{0,200}\d/i

/** Reference-list pages: citations mention models and placeholders that the report itself never used. */
export function isReferencePage(p: Page): boolean {
  return /^\s*(?:\d{1,2}\.?\s+)?(REFERENCES|BIBLIOGRAPHY|LITERATURE CITED)\b/i.test(p.text.slice(0, 320).replace(/^.*?Final Report/i, ''))
    || (p.text.match(/\b(?:19|20)\d{2}[a-z]?\)?\.\s/g) ?? []).length >= 8
}
