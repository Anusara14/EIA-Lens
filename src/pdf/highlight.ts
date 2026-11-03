export interface TextItemLike {
  str: string
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * Find which text items on a page make up an evidence quote. The page text is rebuilt
 * the same way extract.ts builds it, so a quote cut from page text maps back to items.
 * Falls back to the quote's middle when the edges were cut mid-word.
 */
export function findQuoteItems(items: TextItemLike[], quote: string): number[] {
  let text = ''
  const ranges: [number, number, number][] = []
  items.forEach((it, i) => {
    const s = norm(it.str)
    if (!s) return
    if (text) text += ' '
    const start = text.length
    text += s
    ranges.push([i, start, text.length])
  })
  const hay = text.toLowerCase()
  const q = norm(quote.replace(/^…\s*/, '').replace(/\s*…$/, '')).toLowerCase()
  if (!q) return []

  const tries = [q, q.slice(Math.floor(q.length * 0.25), Math.floor(q.length * 0.75)), q.slice(0, 40)]
  for (const t of tries) {
    if (t.length < 12) continue
    const at = hay.indexOf(t)
    if (at < 0) continue
    const end = at + t.length
    return ranges.filter(([, s, e]) => e > at && s < end).map(([i]) => i)
  }
  return []
}
