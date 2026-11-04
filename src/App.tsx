import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Download, FileSearch, LayoutGrid, ListChecks, Map, Moon, RefreshCw, Settings as SettingsIcon, Sun, Upload as UploadIcon, type LucideIcon } from 'lucide-react'
import { useStore, type View } from './store'
import { DeveloperLink, Logo } from './ui/kit'
import { Upload } from './views/Upload'
// Views load on demand so the landing page does not pull in maplibre, recharts or pdf.js.
const Dashboard = lazy(() => import('./views/Dashboard').then((m) => ({ default: m.Dashboard })))
const Review = lazy(() => import('./views/Review').then((m) => ({ default: m.Review })))
const Track = lazy(() => import('./views/Track').then((m) => ({ default: m.Track })))
const Verify = lazy(() => import('./views/Verify').then((m) => ({ default: m.Verify })))
const Settings = lazy(() => import('./views/Settings').then((m) => ({ default: m.Settings })))
import { PrintReport } from './views/PrintReport'

const NAV: { view: View; label: string; Icon: LucideIcon }[] = [
  { view: 'dashboard', label: 'Dashboard', Icon: LayoutGrid },
  { view: 'review', label: 'Review', Icon: FileSearch },
  { view: 'verify', label: 'Verify', Icon: Map },
  { view: 'track', label: 'Track', Icon: ListChecks },
]
const SETTINGS = { view: 'settings' as View, label: 'Settings', Icon: SettingsIcon }

const VIEWS: Partial<Record<View, () => ReactNode>> = {
  dashboard: () => <Dashboard />,
  review: () => <Review />,
  verify: () => <Verify />,
  track: () => <Track />,
  settings: () => <Settings />,
}

function useRelativeTime(ts: number | undefined): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!ts) return ''
  const min = Math.round((now - ts) / 60_000)
  if (min < 1) return 'Analysed just now'
  if (min < 60) return `Analysed ${min} min ago`
  const h = Math.round(min / 60)
  return h < 24 ? `Analysed ${h} h ago` : `Analysed ${Math.round(h / 24)} d ago`
}

function NavButton({ view, label, Icon, mobile = false }: (typeof NAV)[number] & { mobile?: boolean }) {
  const { view: current, go, analysis } = useStore()
  const active = current === view
  return (
    <button
      type="button"
      onClick={() => go(view)}
      disabled={!analysis && view !== 'settings'}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={`flex items-center justify-center transition-colors disabled:opacity-35 ${
        mobile ? 'h-14 flex-1 flex-col gap-1 text-[11px]' : 'size-12 rounded-2xl'
      } ${active ? 'bg-card-2 text-ink' : 'text-ink-2 hover:bg-card hover:text-ink'}`}
    >
      <Icon className="size-5" strokeWidth={1.6} aria-hidden />
      {mobile ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </button>
  )
}

function TopBar() {
  const { analysis, docName, rerun, go, theme, toggleTheme } = useStore()
  const rel = useRelativeTime(analysis?.analysedAt)
  return (
    <header className="flex flex-wrap items-center gap-3 rounded-[24px] bg-card-2 px-5 py-4 sm:px-6">
      <button type="button" onClick={() => go('dashboard')} className="flex shrink-0 items-center gap-2 rounded-full pr-1 text-ink hover:text-link" aria-label="EIA Lens, back to the dashboard">
        <Logo className="size-8 text-mint-500" />
        <span className="hidden text-[17px] font-bold tracking-[-0.01em] lg:inline">EIA Lens</span>
      </button>
      <span className="hidden h-6 w-px bg-line-strong lg:block" aria-hidden />
      <h1 className="mr-1 min-w-0 truncate text-[19px] font-normal tracking-[-0.01em] sm:text-[22px]">{docName ?? 'EIA Lens'}</h1>
      {rel && <span className="hidden rounded-full border border-line-strong px-3 py-1 text-[13px] text-ink-2 sm:inline">{rel}</span>}
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={toggleTheme} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-card hover:text-ink" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun className="size-5" strokeWidth={1.6} /> : <Moon className="size-5" strokeWidth={1.6} />}
        </button>
        <button type="button" onClick={() => go('upload')} className="hidden items-center gap-2 rounded-full px-3 py-2 text-[14px] text-ink-2 hover:bg-card hover:text-ink md:flex">
          <UploadIcon className="size-4" strokeWidth={1.6} aria-hidden /> New PDF
        </button>
        <button type="button" onClick={rerun} disabled={!analysis} className="flex items-center gap-2 rounded-full bg-mint-500 px-4 py-2 text-[14px] font-medium text-on-mint hover:bg-mint-400 active:scale-[0.98] disabled:opacity-40">
          <RefreshCw className="size-4" strokeWidth={1.8} aria-hidden /> Re-run
        </button>
        <button type="button" onClick={() => window.print()} disabled={!analysis} className="flex items-center gap-2 rounded-full border-[1.5px] border-mint-500 px-4 py-2 text-[14px] font-medium text-link hover:bg-mint-500/10 disabled:opacity-40">
          <Download className="size-4" strokeWidth={1.8} aria-hidden /> <span className="hidden sm:inline">Export report</span><span className="sm:hidden">Export</span>
        </button>
      </div>
    </header>
  )
}

const FOOTER = 'EIA Lens prototype · findings are decision support; the planner decides. Satellite turbidity is indicative unless calibrated.'

function Footer({ className = '' }: { className?: string }) {
  return (
    <footer className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12.5px] text-ink-2 ${className}`}>
      <span>{FOOTER}</span>
      <span>
        Developed by <DeveloperLink />
      </span>
    </footer>
  )
}

export default function App() {
  const view = useStore((s) => s.view)

  if (view === 'upload') {
    return (
      <div className="flex min-h-screen flex-col">
        <Upload />
        <Footer className="justify-center px-4 pb-6 text-center sm:px-8" />
      </div>
    )
  }

  return (
    <>
      <div className="flex min-h-screen gap-4 p-3 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-4 md:pb-4 print:hidden">
        <nav aria-label="Main" className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[72px] shrink-0 flex-col items-center gap-2 rounded-[24px] bg-rail py-3 md:flex">
          <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-mint-500 text-on-mint">
            <Logo className="size-7" />
            <span className="sr-only">EIA Lens</span>
          </div>
          {NAV.map((n) => <NavButton key={n.view} {...n} />)}
          <div className="mt-auto"><NavButton {...SETTINGS} /></div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <TopBar />
          <main className="flex-1"><Suspense fallback={null}>{VIEWS[view]?.()}</Suspense></main>
          <Footer className="px-2 pb-2" />
        </div>

        <nav aria-label="Main" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 flex overflow-hidden rounded-[24px] bg-rail md:hidden">
          {[...NAV, SETTINGS].map((n) => <NavButton key={n.view} {...n} mobile />)}
        </nav>
      </div>
      <PrintReport />
    </>
  )
}
