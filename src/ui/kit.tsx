import type { ReactNode } from 'react'
import { Flag, Info, ThumbsDown, ThumbsUp, type LucideIcon } from 'lucide-react'
import type { Evidence, Rating } from '../engine'
import { useStore } from '../store'

export function Logo({ className = '' }: { className?: string }) {
  // EIA-Lens mark: a lens ring with a document fold, authored for this product.
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" strokeWidth="3.2" />
      <path d="M20.5 20.5 27 27" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M10 15.2 12.8 18 18.4 11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const DEVELOPER = { name: 'Anusara14', url: 'https://github.com/Anusara14' }

export function DeveloperLink() {
  return (
    <a href={DEVELOPER.url} target="_blank" rel="noopener noreferrer" className="font-medium text-link underline-offset-4 hover:underline">
      {DEVELOPER.name}
      <span className="sr-only"> (GitHub profile, opens in a new tab)</span>
    </a>
  )
}

interface CardProps {
  icon: LucideIcon
  title: string
  children: ReactNode
  className?: string
  aside?: ReactNode
}

export function Card({ icon: Icon, title, children, className = '', aside }: CardProps) {
  return (
    <section aria-label={title} className={`card flex flex-col gap-5 rounded-[var(--radius-card)] bg-card p-6 ${className}`}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 whitespace-nowrap text-[15px] font-normal text-ink">
          <Icon className="size-[18px] text-ink-2" strokeWidth={1.6} aria-hidden />
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  )
}

const RATING: Record<Rating, { cls: string; Icon: LucideIcon }> = {
  Excellent: { cls: 'bg-mint-500', Icon: ThumbsUp },
  Average: { cls: 'bg-mint-300', Icon: Info },
  Poor: { cls: 'bg-mint-50', Icon: ThumbsDown },
}

export function RatingPill({ rating, size = 'lg' }: { rating: Rating; size?: 'lg' | 'sm' }) {
  const { cls, Icon } = RATING[rating]
  const lg = size === 'lg'
  return (
    <div className={`inline-flex w-fit items-center rounded-[22px] text-on-mint ${cls} ${lg ? 'gap-6 px-6 py-3.5 text-[32px] font-light tracking-[-0.02em]' : 'gap-2 rounded-full px-3 py-1 text-sm'}`}>
      <span>{rating}</span>
      <Icon className={lg ? 'size-6' : 'size-4'} strokeWidth={1.6} aria-hidden />
    </div>
  )
}

/** The "ⓘ Based on ESIA p. 7-62 · View" footer: an evidence link into the Review workspace. */
export function EvidencePill({ ev, prefix = 'Based on ESIA' }: { ev?: Evidence; prefix?: string }) {
  const openEvidence = useStore((s) => s.openEvidence)
  if (!ev) return null
  const where = ev.label ? `p. ${ev.label}` : `PDF page ${ev.pdfPage}`
  return (
    <button
      type="button"
      onClick={() => openEvidence({ pdfPage: ev.pdfPage, quote: ev.quote })}
      className="group mt-auto flex w-full items-center gap-2.5 rounded-full border border-line-strong px-4 py-2.5 text-left text-[13px] font-medium text-ink transition-colors hover:border-mint-500 hover:bg-card-2"
    >
      <Info className="size-4 shrink-0 text-ink-2" strokeWidth={1.6} aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        {prefix} {where}
      </span>
      <span className="text-link group-hover:underline underline-offset-4">View</span>
      <span className="sr-only">evidence on {where}</span>
    </button>
  )
}

export function OutlinePill({ children, icon: Icon = Info }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong px-3 py-1 text-[12.5px] text-ink-2">
      <Icon className="size-3.5" strokeWidth={1.6} aria-hidden />
      {children}
    </span>
  )
}

interface ProgressProps {
  value: number // 0..100
  goal: number
  label: string
  goalLabel: string
  icon: LucideIcon
}

export function ProgressBar({ value, goal, label, goalLabel, icon: Icon }: ProgressProps) {
  return (
    <div className="flex items-center gap-4 rounded-[24px] bg-card-2 px-5 py-4" role="group" aria-label={label}>
      <span className="flex shrink-0 items-center gap-2 text-[15px] text-ink">
        <Icon className="size-[18px] text-ink-2" strokeWidth={1.6} aria-hidden />
        <span className="hidden sm:inline">{label}</span>
      </span>
      <div
        className="relative h-6 flex-1 rounded-full bg-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={`${label}: ${value}%, target ${goal}%`}
      >
        <div data-fill className="h-full rounded-full bg-mint-500" style={{ width: `${Math.max(value, 4)}%` }} />
        <div className="absolute inset-y-0 flex items-center gap-1.5 border-l border-mint-600 pl-2 text-[12px] font-medium text-link" style={{ left: `${goal}%` }}>
          <Flag className="size-3.5" strokeWidth={1.8} aria-hidden />
          <span className="whitespace-nowrap">
            {goal}% <span className="hidden md:inline">{goalLabel}</span>
          </span>
        </div>
      </div>
      <span data-count={value} className="num w-12 shrink-0 text-right text-[22px] font-light">
        {value}%
      </span>
    </div>
  )
}
