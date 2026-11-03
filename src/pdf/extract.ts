import type { Page } from '../engine/types'

/** Minimal slice of the pdf.js document API we use, so browser and Node builds both fit. */
export interface PdfDoc {
  numPages: number
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>
}

/** ESIA footers read "Page 7-62"; map PDF page → printed label. */
export function pageLabel(text: string): string | null {
  return /Page\s+(\d{1,2}\s?-\s?\d{1,3})\b/.exec(text)?.[1].replace(/\s/g, '') ?? null
}

/**
 * Reports without "Page 7-62" footers usually print a plain page number in the running header or
 * footer ("… (Kadawatha to Dambulla) 18", "Page | 31"). Front matter shifts it from the PDF index by a
 * fixed amount, so vote for that offset across pages and label every page that agrees with it.
 */
export function numberLabels(pages: Page[]): Page[] {
  if (pages.filter((p) => p.label).length > pages.length * 0.3) return pages
  const candidates = pages.map((p) => {
    const edges = p.text.slice(0, 160) + ' ' + p.text.slice(-80)
    return new Set([...edges.matchAll(/(?<![\d.,/:-])(\d{1,4})(?![\d.,/:%-])/g)].map((m) => +m[1]).filter((n) => n >= 1 && n <= pages.length))
  })
  const votes = new Map<number, number>()
  candidates.forEach((c, i) => c.forEach((n) => votes.set(pages[i].index - n, (votes.get(pages[i].index - n) ?? 0) + 1)))
  const [offset, count] = [...votes].reduce((best, v) => (v[1] > best[1] ? v : best), [0, 0])
  if (count < Math.max(5, pages.length * 0.3)) return pages
  return pages.map((p, i) => (candidates[i].has(p.index - offset) ? { ...p, label: String(p.index - offset) } : p))
}

export async function extractPages(doc: PdfDoc, onProgress?: (done: number, total: number) => void): Promise<Page[]> {
  const pages: Page[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent()
    const text = content.items
      .map((it) => (typeof it === 'object' && it && 'str' in it ? String((it as { str: string }).str) : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    pages.push({ index: n, label: pageLabel(text), text })
    if (n % 10 === 0 || n === doc.numPages) onProgress?.(n, doc.numPages)
  }
  return numberLabels(pages)
}
