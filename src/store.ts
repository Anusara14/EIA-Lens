import { create } from 'zustand'
import type { Analysis, Page } from './engine'
import type { PDFDocumentProxy } from './pdf/load'

// pdf.js (~1 MB) loads on first use, not with the landing page.
const pdfLib = () => Promise.all([import('./pdf/load'), import('./pdf/extract')]).then(([l, e]) => ({ openPdf: l.openPdf, extractPages: e.extractPages }))

export type View = 'upload' | 'dashboard' | 'review' | 'verify' | 'track' | 'settings'
export type Theme = 'dark' | 'light'

export const STEPS = ['Reading pages', 'Finding models', 'Running 10 audit rules', 'Scoring auditability', 'Building scorecard'] as const

export type PromiseStatus = 'Not started' | 'In progress' | 'Met' | 'Breached'

export interface AiSettings {
  key: string // held in memory only, never persisted
  on: boolean
}

export interface ReviewTarget {
  pdfPage: number
  quote?: string
}

interface State {
  view: View
  theme: Theme
  docName: string | null
  isDemo: boolean
  analysis: Analysis | null
  pages: Page[] | null
  pdf: PDFDocumentProxy | null
  step: number // index into STEPS while analysing, -1 when idle
  pageProgress: number // 0..1 while reading pages
  error: string | null
  target: ReviewTarget | null
  docLoading: boolean
  empStatus: Record<string, PromiseStatus>
  ai: AiSettings
  go: (view: View) => void
  ensureDocument: () => Promise<void>
  setEmpStatus: (id: string, s: PromiseStatus) => void
  setAi: (ai: Partial<AiSettings>) => void
  openEvidence: (t: ReviewTarget) => void
  toggleTheme: () => void
  runFile: (file: File) => Promise<void>
  runDemo: () => Promise<void>
  rerun: () => Promise<void>
}

const SAVE_KEY = 'eia-lens:last:v4' // bump when Analysis changes shape
const EMP_KEY = 'eia-lens:emp-status'
const THEME_KEY = 'eia-lens:theme'
const DEMO_URL = '/demo/WCT1_ESIA_2023.pdf'

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked (private mode): the session still works, it just won't persist.
  }
}

const saved = load<{ docName: string; isDemo: boolean; analysis: Analysis }>(SAVE_KEY)
const tick = () => new Promise((r) => setTimeout(r, 0))

export const useStore = create<State>((set, get) => {
  async function run(data: ArrayBuffer, docName: string, isDemo: boolean) {
    set({ step: 0, pageProgress: 0, error: null, docName, isDemo })
    try {
      const { openPdf, extractPages } = await pdfLib()
      const pdf = await openPdf(data)
      const pages = await extractPages(pdf, (done, total) => set({ pageProgress: done / total }))
      // The engine is synchronous and fast; step through the labels so the user sees what ran.
      for (let s = 1; s < STEPS.length; s++) {
        set({ step: s })
        await tick()
      }
      const { analyse } = await import('./engine') // with its 350 KB gazetteer, off the landing page
      const analysis = analyse(pages)
      save(SAVE_KEY, { docName, isDemo, analysis })
      set({ pdf, pages, analysis, step: -1, view: 'dashboard' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      set({ step: -1, error: `Could not read this PDF (${msg}). Try another file, or load the demo.` })
    }
  }

  const theme = load<Theme>(THEME_KEY) ?? 'dark'
  document.documentElement.dataset.theme = theme

  return {
    view: saved ? 'dashboard' : 'upload',
    theme,
    docName: saved?.docName ?? null,
    isDemo: saved?.isDemo ?? false,
    analysis: saved?.analysis ?? null,
    pages: null,
    pdf: null,
    step: -1,
    pageProgress: 0,
    error: null,
    target: null,
    docLoading: false,
    empStatus: load<Record<string, PromiseStatus>>(EMP_KEY) ?? {},
    ai: { key: '', on: false },
    go: (view) => set({ view }),
    ensureDocument: async () => {
      const { pdf, isDemo, docLoading } = get()
      if (pdf || docLoading || !isDemo) return
      // After a reload only the analysis survives; the demo PDF can be fetched again.
      set({ docLoading: true })
      try {
        const res = await fetch(DEMO_URL)
        if (!res.ok) throw new Error(`demo file missing (${res.status})`)
        const { openPdf, extractPages } = await pdfLib()
        const doc = await openPdf(await res.arrayBuffer())
        set({ pdf: doc, pages: await extractPages(doc), docLoading: false })
      } catch (e: unknown) {
        set({ docLoading: false, error: `Could not reopen the demo PDF: ${e instanceof Error ? e.message : 'unknown error'}.` })
      }
    },
    setEmpStatus: (id, status) => {
      const empStatus = { ...get().empStatus, [id]: status }
      save(EMP_KEY, empStatus)
      set({ empStatus })
    },
    setAi: (ai) => set({ ai: { ...get().ai, ...ai } }),
    openEvidence: (target) => set({ target, view: 'review' }),
    toggleTheme: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      save(THEME_KEY, next)
      set({ theme: next })
    },
    runFile: async (file) => {
      if (file.type && file.type !== 'application/pdf') {
        set({ error: `"${file.name}" is not a PDF. Drop an EIA or ESIA report in PDF format.` })
        return
      }
      await run(await file.arrayBuffer(), file.name.replace(/\.pdf$/i, ''), false)
    },
    runDemo: async () => {
      set({ step: 0, pageProgress: 0, error: null })
      try {
        const res = await fetch(DEMO_URL)
        if (!res.ok) throw new Error(`demo file missing (${res.status})`)
        await run(await res.arrayBuffer(), 'WCT-1 Colombo Port ESIA', true)
      } catch (e: unknown) {
        set({ step: -1, error: `Demo could not load: ${e instanceof Error ? e.message : 'unknown error'}.` })
      }
    },
    rerun: async () => {
      const { pages, docName, isDemo } = get()
      if (!pages) return isDemo ? get().runDemo() : set({ view: 'upload' })
      const { analyse } = await import('./engine')
      const analysis = analyse(pages)
      save(SAVE_KEY, { docName, isDemo, analysis })
      set({ analysis })
    },
  }
})
