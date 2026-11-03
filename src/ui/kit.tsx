import type { ReactNode } from 'react'
import { Flag, Info, ThumbsDown, ThumbsUp, type LucideIcon } from 'lucide-react'
import type { Evidence, Rating } from '../engine'
import { useStore } from '../store'

// EIA Lens mark ("EIA Lens logo 2.svg"). Cropped to the artwork, filled with currentColor.
export const LOGO_PATHS = [
  'M439.003 259.796 C439.655 249.356 447.696 246.631 456.508 244.858 C468.624 242.419 480.825 240.323 492.987 238.137 C498.489 237.148 504.451 235.217 510.069 235.509 C514.673 235.748 519.358 237.354 523.278 239.758 C539.34 249.61 546.369 268.388 554.811 284.454 C569.178 311.794 584.124 338.834 598.564 366.137 C603.426 375.332 619.441 400.34 618.195 409.474 C617.947 411.296 617.126 413.25 615.941 414.661 C612.344 418.945 599.507 428.693 594.137 429.71 C590.353 430.427 586.378 429.145 583.284 426.948 C577.545 422.874 572.907 416.422 568.233 411.205 C560.46 402.528 552.367 394.143 544.559 385.493 C520.593 358.943 496.256 332.606 471.747 306.559 C461.766 295.952 438.07 274.753 439.003 259.796 Z',
  'M667.664 418.582 L675.558 425.109 C686.714 408.312 698.27 391.77 709.405 374.96 C712.223 370.706 718.835 358.472 723.584 357.249 C729.846 355.636 735.181 361.966 738.041 366.649 C742.399 373.787 746.365 381.185 750.642 388.374 C753.81 393.698 757.64 399.114 759.605 405.024 C760.753 408.478 761.46 413.233 760.259 416.772 C758.222 422.774 749.182 426.982 744.339 430.622 C729.854 441.509 714.827 451.72 700.562 462.894 L704.21 473.929 C722.162 474.709 740.111 475.677 758.067 476.367 C765.233 476.642 775.732 475.088 781.851 479.278 C791.505 485.888 792.835 520.582 794.271 532.379 C794.945 537.915 794.706 545.548 789.025 548.505 C784.262 550.985 771.242 544.183 766.225 542.18 C743.671 533.177 724.638 526.588 706.072 509.995 C665.162 473.435 637.449 422.291 624.77 369.154 C621.514 355.506 619.905 341.571 617.964 327.696 C616.29 315.722 614.739 303.731 613.049 291.759 C612.081 284.901 609.105 275.709 610.99 268.909 C613.667 259.256 624.223 262.053 630.379 265.97 C638.941 271.418 647.445 276.945 655.979 282.443 C660.74 285.51 666.073 288.281 670.052 292.363 C672.742 295.123 674.647 298.546 676.3 301.997 C680.858 311.513 676.799 325.89 675.975 336.159 C673.769 363.664 670.393 391.121 667.664 418.582 Z',
  'M629.62 563.482 L618.542 557.174 C587.982 605.524 557.043 653.722 527.211 702.52 C521.77 711.421 516.021 720.13 510.552 729.008 C501.902 743.049 494.066 759.527 479.263 768.108 C470.834 772.995 460.137 776.394 450.507 772.932 C439.982 769.15 431.572 758.429 423.374 751.14 C412.725 741.672 402.261 732.005 391.65 722.488 C384.262 715.861 371.339 706.602 366.978 697.935 C362.943 689.915 363.022 680.291 365.735 671.847 C371.255 654.665 385.305 645.749 399.385 636.167 C407.879 630.387 416.488 624.778 425.012 619.036 C477.827 583.454 530.716 547.889 583.959 512.965 L578.425 496.746 C517.118 497.156 455.792 496.743 394.482 496.743 L361.492 496.743 C345.764 496.743 328.939 498.276 314.91 489.636 C306.453 484.427 298.824 476.889 296.917 466.734 C294.884 455.914 302.575 434.182 305.723 423.027 C308.295 413.913 310.446 404.672 312.988 395.548 C315.76 385.601 318.21 367.874 324.638 360.178 C331.486 351.98 343.547 348.995 353.805 349.301 C370.896 349.812 386.87 359.068 402.247 365.693 C419.527 373.139 436.87 380.435 454.161 387.845 C490.174 403.276 526.78 417.2 559.775 438.672 C631.725 485.496 670.615 557.603 683.34 640.998 C688.083 672.08 692.728 703.224 696.896 734.387 C698.829 748.837 698.734 766.324 686.149 776.497 C679.993 781.473 664.784 786.505 656.982 789.818 C648.844 793.275 632.582 802.062 624.644 803.114 C618.259 803.961 612.001 800.539 608.807 794.988 C606.797 791.495 605.324 787.365 604.858 783.354 C603.968 775.682 605.461 767.986 606.344 760.383 C607.644 749.192 608.836 737.983 610.274 726.809 C617.269 672.454 623.504 617.938 629.62 563.482 Z',
  'M680.847 558.3 C680.838 556.038 681.166 553.55 682.053 551.462 C683.806 547.34 692.856 533.836 696.333 531.458 C698.59 529.914 701.461 529.322 704.101 530.306 C709.895 532.467 721.913 548.343 726.585 553.605 C739.872 568.568 753.45 583.284 766.614 598.365 C771.612 604.091 778.139 609.446 781.765 616.198 C784.47 621.233 785.107 626.97 784.989 632.589 C784.799 641.618 779.316 651.153 776.22 659.51 C773.22 667.611 770.681 676.41 766.727 684.097 C764.153 689.102 758.747 692.313 753.194 690.33 C746.884 688.078 736.997 666.619 733.552 660.063 C721.638 637.395 709.676 614.534 696.917 592.332 C692.406 584.48 680.882 566.83 680.847 558.3 Z',
]

export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="245 219 600 600" aria-hidden className={className} fill="currentColor">
      {LOGO_PATHS.map((d) => <path key={d.slice(0, 16)} d={d} />)}
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

/** The "ⓘ Based on p. 7-62 · View" footer: an evidence link into the Review workspace. */
export function EvidencePill({ ev, prefix = 'Based on' }: { ev?: Evidence; prefix?: string }) {
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
