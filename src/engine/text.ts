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

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase())
}

/** A money figure (USD 650, LKR 2.5, $120). Word-bounded so "years 2" is not read as "Rs 2". */
export const BUDGET = /(?:\b(?:USD|LKR|SLR|Rs\.?)|US\$|\$)\s?\d[\d,.]*/
