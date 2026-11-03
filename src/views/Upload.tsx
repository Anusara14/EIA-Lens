import { useRef, useState, type DragEvent } from 'react'
import { Check, FileUp, Loader2, Ship } from 'lucide-react'
import { STEPS, useStore } from '../store'
import { Logo } from '../ui/kit'

function Progress() {
  const { step, pageProgress } = useStore()
  return (
    <ol className="flex flex-col gap-2" aria-live="polite">
      {STEPS.map((label, i) => {
        const done = i < step
        const active = i === step
        return (
          <li key={label} className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] transition-colors ${active ? 'bg-mint-500 text-on-mint' : done ? 'bg-card-2 text-ink' : 'text-ink-2'}`}>
            {done ? <Check className="size-4" strokeWidth={2} aria-hidden /> : active ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <span className="size-4" />}
            <span className="flex-1">{label}</span>
            {active && i === 0 && <span className="num text-[13px]">{Math.round(pageProgress * 100)}%</span>}
          </li>
        )
      })}
    </ol>
  )
}

export function Upload() {
  const { step, error, runFile, runDemo, analysis, go } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const busy = step >= 0

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    const f = e.dataTransfer.files[0]
    if (f && !busy) void runFile(f)
  }

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-10 px-4 py-10 sm:px-8 sm:py-16">
      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-mint-500 text-on-mint">
          <Logo className="size-6" />
        </span>
        <span className="text-[22px] tracking-[-0.01em]">EIA-Lens</span>
        {analysis && (
          <button type="button" onClick={() => go('dashboard')} className="ml-auto rounded-full border border-line-strong px-4 py-2 text-[14px] text-ink-2 hover:border-mint-500 hover:text-ink">
            Back to last scorecard
          </button>
        )}
      </header>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <div>
          <h1 className="text-[clamp(44px,7vw,84px)] leading-[0.98] font-light tracking-[-0.035em] text-balance">
            Review. Verify. <span className="text-mint-500">Track.</span>
          </h1>
          <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-ink-2">
            Upload an Environmental Impact Assessment and get a scorecard in under a minute. Ten fixed audit rules check the science; every red flag links to the page that proves it. The planner makes the decision.
          </p>
        </div>
        <p className="max-w-[44ch] text-[14px] leading-relaxed text-ink-2 lg:justify-self-end">
          Runs entirely in your browser. No upload leaves this machine and no API key is needed.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <label
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={`relative flex min-h-[300px] cursor-pointer flex-col items-start justify-end gap-4 rounded-[var(--radius-card)] border-2 border-dashed p-8 transition-colors ${
            over ? 'border-mint-500 bg-card-2' : 'border-line-strong bg-card hover:border-mint-600'
          } ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          <FileUp className="absolute top-8 left-8 size-9 text-mint-500" strokeWidth={1.4} aria-hidden />
          <span className="text-[30px] font-light tracking-[-0.02em]">Drop an EIA / ESIA PDF</span>
          <span className="text-[14px] text-ink-2">or click to choose a file · text-based PDFs work best</span>
          <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void runFile(f) }} />
        </label>

        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-card p-6">
          {busy ? (
            <>
              <h2 className="text-[15px] text-ink-2">Analysing</h2>
              <Progress />
            </>
          ) : (
            <>
              <h2 className="flex items-center gap-2.5 text-[15px]">
                <Ship className="size-[18px] text-ink-2" strokeWidth={1.6} aria-hidden /> Demo case
              </h2>
              <p className="text-[15px] leading-relaxed text-ink-2">
                West Container Terminal-1, Colombo Port, Sri Lanka. ESIA by ERM, Final v5.0, 7 April 2023. 317 pages.
              </p>
              <button type="button" onClick={() => void runDemo()} className="mt-auto rounded-[20px] bg-mint-500 px-5 py-4 text-left text-[17px] font-medium text-on-mint hover:bg-mint-400 active:scale-[0.99]">
                Load demo: WCT-1 Colombo Port (2023)
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="rounded-2xl bg-mint-50 px-4 py-3 text-[14px] text-on-mint">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
