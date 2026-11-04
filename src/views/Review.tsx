import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, FileSearch, Info, Sparkles, Users, Cpu, type LucideIcon } from 'lucide-react'
import type { Severity } from '../engine'
import { useStore } from '../store'
import { buildFlags, SECTIONS, type Flag } from '../lib/flags'
import { suggestFix, type CitedText } from '../lib/ai'
import { PdfThumb, PdfViewer } from '../ui/PdfViewer'

type Filter = 'All' | 'High' | 'A' | 'B' | 'C'
const FILTERS: Filter[] = ['All', 'High', 'A', 'B', 'C']
const SEV_ICON: Record<Severity, LucideIcon> = { High: AlertTriangle, Medium: AlertCircle, Low: Info }

function AiFix({ flag }: { flag: Flag }) {
  const { ai, pages } = useStore()
  const [state, setState] = useState<{ busy: boolean; out?: CitedText; err?: string }>({ busy: false })
  if (!ai.on || !ai.key) return null
  async function run() {
    if (!pages) return
    setState({ busy: true })
    try {
      setState({ busy: false, out: await suggestFix(ai.key, pages, { title: flag.title, explanation: flag.explanation, quote: flag.evidence[0]?.quote }) })
    } catch (e: unknown) {
      setState({ busy: false, err: e instanceof Error ? e.message : 'AI suggestion failed.' })
    }
  }
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-card-2 p-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-600 px-2.5 py-0.5 text-[12px] text-link">
          <Sparkles className="size-3.5" aria-hidden /> AI-assisted
        </span>
        {!state.out && (
          <button type="button" disabled={state.busy || !pages} onClick={run} className="text-[13px] text-link underline-offset-4 hover:underline disabled:opacity-50">
            {state.busy ? 'Drafting…' : 'Draft a cited fix with Claude'}
          </button>
        )}
      </div>
      {state.err && <p role="alert" className="text-[13px] text-ink">{state.err}</p>}
      {state.out && (
        <>
          {state.out.sentences.length ? (
            <ul className="flex flex-col gap-1 text-[13.5px] leading-relaxed text-ink">
              {state.out.sentences.map((s) => <li key={s.text}>{s.text}</li>)}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-2">No sentence came back with a valid page citation, so nothing is shown.</p>
          )}
          {state.out.dropped > 0 && <p className="text-[12px] text-ink-2">{state.out.dropped} uncited sentence{state.out.dropped > 1 ? 's' : ''} dropped.</p>}
        </>
      )}
    </div>
  )
}

interface FlagCardProps {
  flag: Flag
  active: boolean
  onPick: (flag: Flag, evIndex?: number) => void
}

function FlagCard({ flag, active, onPick }: FlagCardProps) {
  const SevIcon = SEV_ICON[flag.severity]
  const SrcIcon = flag.source === 'engine' ? Cpu : Users
  const ev = flag.evidence[0]
  return (
    <li className={`rounded-[20px] transition-colors ${active ? 'bg-mint-50 text-on-mint' : 'bg-card-2 text-ink'}`}>
      <button type="button" onClick={() => onPick(flag)} aria-expanded={active} className="flex w-full flex-col gap-2 rounded-[20px] p-4 text-left">
        <span className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${flag.severity === 'High' ? (active ? 'bg-on-mint text-mint-50' : 'bg-mint-50 text-on-mint') : 'border border-current/40'}`}>
            <SevIcon className="size-3.5" strokeWidth={2} aria-hidden /> {flag.severity}
          </span>
          <span className="inline-flex items-center gap-1 opacity-75">
            <SrcIcon className="size-3.5" strokeWidth={1.8} aria-hidden /> {flag.source === 'engine' ? `Engine ${flag.ruleId}` : `Expert ${flag.id}`}
          </span>
          {flag.agrees && <span className="opacity-75">· engine agrees ({flag.ruleId})</span>}
          {ev && <span className="ml-auto rounded-full border border-current/40 px-2 py-0.5">p. {ev.label ?? ev.pdfPage}</span>}
        </span>
        <span className="text-[15px] leading-snug font-medium">{flag.title}</span>
        {flag.source === 'engine' && <span className={`text-[13.5px] leading-relaxed ${active ? '' : 'text-ink-2'}`}>{flag.explanation}</span>}
      </button>
      {active && (
        <div className="flex flex-col gap-3 px-4 pb-4 text-[13.5px]">
          {flag.evidence.map((e, i) => (
            <button
              type="button"
              key={`${e.pdfPage}-${i}`}
              onClick={() => onPick(flag, i)}
              className="rounded-2xl border border-on-mint/25 p-3 text-left leading-relaxed hover:border-on-mint/60"
            >
              <span className="mb-1 block text-[12px] font-medium">Evidence · p. {e.label ?? `PDF ${e.pdfPage}`}</span>
              <q className="italic">{e.quote.replace(/^…\s*|\s*…$/g, '')}</q>
            </button>
          ))}
          {flag.needsConfirmation && <p className="text-[12.5px]">Regex-based check: needs reviewer confirmation.</p>}
          <details className="group rounded-2xl bg-on-mint/8 p-3">
            <summary className="cursor-pointer font-medium marker:content-none">
              <span className="inline-block transition-transform group-open:rotate-90">›</span> Suggested fix
            </summary>
            <p className="mt-2 leading-relaxed">{flag.fix}</p>
          </details>
          <AiFix flag={flag} />
        </div>
      )}
    </li>
  )
}

export function Review() {
  const { analysis, isDemo, pdf, target, openEvidence, ensureDocument, docLoading, go, pages } = useStore()
  const [filter, setFilter] = useState<Filter>('All')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [found, setFound] = useState<boolean | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { void ensureDocument() }, [ensureDocument])

  const flags = useMemo(() => (analysis ? buildFlags(analysis, isDemo) : []), [analysis, isDemo])
  const shown = flags.filter((f) => filter === 'All' || (filter === 'High' ? f.severity === 'High' : f.section === filter))
  const evidencePages = useMemo(() => [...new Set(flags.flatMap((f) => f.evidence.map((e) => e.pdfPage)))].sort((a, b) => a - b), [flags])

  const page = target?.pdfPage ?? flags[0]?.evidence[0]?.pdfPage ?? 1
  const numPages = pdf?.numPages ?? analysis?.pageCount ?? 1
  const labelOf = (n: number) => (pages ? pages[n - 1]?.label : Object.entries(analysis?.labels ?? {}).find(([, v]) => v === n)?.[0]) ?? null

  const pick = useCallback((flag: Flag, i = 0) => {
    setActiveId(flag.id)
    const ev = flag.evidence[i]
    if (ev) openEvidence({ pdfPage: ev.pdfPage, quote: ev.quote })
  }, [openEvidence])

  const onHighlight = useCallback((ok: boolean) => setFound(ok), [])
  const goPage = (n: number) => openEvidence({ pdfPage: Math.min(numPages, Math.max(1, n)) })

  if (!analysis) return null

  return (
    <div className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-150px)] lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,1fr)] [&>*]:min-w-0">
      <section aria-label="Report document" className="flex min-h-[70vh] flex-col gap-3 rounded-[var(--radius-card)] bg-card p-4 lg:min-h-0">
        <header className="flex flex-wrap items-center gap-2 px-2">
          <h2 className="flex items-center gap-2.5 text-[15px]"><FileSearch className="size-[18px] text-ink-2" strokeWidth={1.6} aria-hidden /> Document</h2>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => goPage(page - 1)} disabled={page <= 1} className="grid size-9 place-items-center rounded-full hover:bg-card-2 disabled:opacity-35" aria-label="Previous page"><ChevronLeft className="size-5" /></button>
            <span className="num min-w-[150px] text-center text-[13.5px]">
              PDF {page} / {numPages}{labelOf(page) && <span className="text-ink-2"> · printed p. {labelOf(page)}</span>}
            </span>
            <button type="button" onClick={() => goPage(page + 1)} disabled={page >= numPages} className="grid size-9 place-items-center rounded-full hover:bg-card-2 disabled:opacity-35" aria-label="Next page"><ChevronRight className="size-5" /></button>
          </div>
        </header>

        {pdf && (
          <nav aria-label="Pages with evidence" className="flex gap-2 overflow-x-auto px-1 pb-1">
            {evidencePages.map((n) => (
              <button key={n} type="button" onClick={() => goPage(n)} aria-current={n === page ? 'page' : undefined}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-xl p-1.5 text-[11.5px] ${n === page ? 'bg-mint-500 text-on-mint' : 'text-ink-2 hover:bg-card-2'}`}>
                <PdfThumb pdf={pdf} page={n} width={52} />
                {labelOf(n) ?? n}
              </button>
            ))}
          </nav>
        )}

        <div className="min-h-0 flex-1">
          {pdf ? (
            <PdfViewer pdf={pdf} page={page} quote={target?.quote} onHighlight={onHighlight} />
          ) : (
            <div className="grid h-full place-items-center rounded-[22px] bg-card-2 p-8 text-center text-ink-2">
              {docLoading ? 'Opening the PDF…' : isDemo ? 'Loading…' : (
                <span>The PDF is not kept between visits. <button type="button" onClick={() => go('upload')} className="text-link underline underline-offset-4">Upload it again</button> to view pages.</span>
              )}
            </div>
          )}
        </div>
        {target?.quote && found === false && (
          <p className="px-2 text-[12.5px] text-ink-2" aria-live="polite">Quote not located exactly on this page; read the evidence text on the right.</p>
        )}
      </section>

      <section aria-label="Flags" className="flex min-h-0 flex-col gap-3 rounded-[var(--radius-card)] bg-card p-4">
        <div className="flex flex-wrap items-center gap-2 px-2" role="group" aria-label="Filter flags">
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-[13.5px] ${filter === f ? 'bg-mint-500 text-on-mint' : 'border border-line-strong text-ink-2 hover:text-ink'}`}>
              {f.length === 1 ? `Section ${f}` : f}
            </button>
          ))}
          <span className="num ml-auto text-[13px] text-ink-2">{shown.length} flags</span>
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
          {(['A', 'B', 'C'] as const).map((s) => {
            const group = shown.filter((f) => f.section === s)
            if (!group.length) return null
            return (
              <div key={s} className="mb-5">
                <h3 className="mb-2 px-2 text-[13px] text-ink-2">Section {s} · {SECTIONS[s]}</h3>
                <ul className="flex flex-col gap-2">
                  {group.map((f) => <FlagCard key={`${f.source}-${f.id}`} flag={f} active={activeId === f.id} onPick={pick} />)}
                </ul>
              </div>
            )
          })}
          {!shown.length && <p className="p-4 text-ink-2">No flags match this filter.</p>}
        </div>
      </section>
    </div>
  )
}
