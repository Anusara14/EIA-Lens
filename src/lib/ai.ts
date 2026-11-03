import type { Page } from '../engine'

const MODEL = 'claude-sonnet-5-5'
const STOP = new Set(['with', 'that', 'this', 'from', 'have', 'which', 'there', 'their', 'will', 'would', 'should', 'report', 'page'])

const terms = (s: string) => [...new Set(s.toLowerCase().match(/[a-z0-9₂]{4,}/g) ?? [])].filter((t) => !STOP.has(t))

/** Plain term-overlap retrieval over page text. Deterministic and good enough for a handful of pages. */
export function retrieve(pages: Page[], query: string, k = 4): Page[] {
  const q = terms(query)
  return pages
    .filter((p) => p.label)
    .map((p) => {
      const t = p.text.toLowerCase()
      return { p, score: q.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.p)
}

export interface CitedText {
  sentences: { text: string; label: string }[]
  dropped: number // sentences removed because they cited no provided page
}

/** Keep only sentences that cite one of the pages we actually sent. */
export function keepCited(raw: string, allowed: Set<string>): CitedText {
  const parts = raw.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z])/)
  const sentences: CitedText['sentences'] = []
  let dropped = 0
  for (const s of parts) {
    const m = /\[p\.\s*(\d{1,2}-\d{1,3}|\d{1,4})\]/.exec(s) // "7-62" chapter labels or plain page numbers
    if (m && allowed.has(m[1])) sentences.push({ text: s.trim(), label: m[1] })
    else if (s.trim()) dropped++
  }
  return { sentences, dropped }
}

/** Ask Claude for a suggested fix, grounded in retrieved ESIA pages. Key is passed per call, never stored. */
export async function suggestFix(key: string, pages: Page[], finding: { title: string; explanation: string; quote?: string }): Promise<CitedText> {
  const ctx = retrieve(pages, `${finding.title} ${finding.explanation} ${finding.quote ?? ''}`)
  const allowed = new Set(ctx.map((p) => p.label!))
  const sources = ctx.map((p) => `<page label="${p.label}">\n${p.text.slice(0, 3000)}\n</page>`).join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system:
        'You help an urban planner review an Environmental Impact Assessment. Write 2 to 4 short sentences proposing what the consultant must do to fix the finding. ' +
        'End every sentence with a citation in the form [p. 7-62], using only page labels from the provided pages. If the pages do not support a sentence, leave it out. Do not decide whether the project is approved.',
      messages: [{ role: 'user', content: `<finding>\n${finding.title}\n${finding.explanation}\n</finding>\n${sources}` }],
    }),
  })
  if (!res.ok) {
    const detail = res.status === 401 ? 'the API key was rejected' : `the API returned ${res.status}`
    throw new Error(`AI suggestion failed: ${detail}.`)
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] }
  const text = (json.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join(' ')
  return keepCited(text, allowed)
}
