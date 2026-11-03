import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { Util } from 'pdfjs-dist'
import type { PDFDocumentProxy } from '../pdf/load'
import { findQuoteItems } from '../pdf/highlight'

gsap.registerPlugin(ScrollToPlugin)

interface Rect { left: number; top: number; width: number; height: number }

interface PdfViewerProps {
  pdf: PDFDocumentProxy
  page: number
  quote?: string
  onHighlight?: (found: boolean) => void
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** One page at a time, fitted to width, with the evidence quote outlined in mint. */
export function PdfViewer({ pdf, page, quote, onHighlight }: PdfViewerProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [rects, setRects] = useState<Rect[]>([])
  const [width, setWidth] = useState(0)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!width || !canvas.current) return
    let cancelled = false
    let task: { cancel(): void; promise: Promise<void> } | null = null
    setBusy(true)
    ;(async () => {
      const p = await pdf.getPage(page)
      const base = p.getViewport({ scale: 1 })
      const viewport = p.getViewport({ scale: (width - 32) / base.width })
      const dpr = window.devicePixelRatio || 1
      const c = canvas.current!
      c.width = Math.floor(viewport.width * dpr)
      c.height = Math.floor(viewport.height * dpr)
      c.style.width = `${viewport.width}px`
      c.style.height = `${viewport.height}px`
      task = p.render({ canvas: c, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] })
      try {
        await task.promise
      } catch {
        return // superseded by a newer render
      }
      if (cancelled) return

      let found: Rect[] = []
      if (quote) {
        const { items } = await p.getTextContent()
        const textItems = items.filter((it): it is typeof it & { str: string; transform: number[]; width: number } => 'str' in it)
        found = findQuoteItems(textItems, quote).map((i) => {
          const it = textItems[i]
          const tx = Util.transform(viewport.transform, it.transform)
          const h = Math.hypot(tx[2], tx[3])
          return { left: tx[4], top: tx[5] - h, width: it.width * viewport.scale, height: h * 1.15 }
        })
      }
      if (cancelled) return
      setRects(found)
      setBusy(false)
      onHighlight?.(found.length > 0)
      const el = scroller.current
      if (el) {
        const y = found.length ? Math.max(0, Math.min(...found.map((r) => r.top)) - 96) : 0
        gsap.to(el, { scrollTo: { y }, duration: reduced() ? 0 : 0.55, ease: 'expo.out' })
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdf, page, quote, width, onHighlight])

  return (
    <div ref={scroller} className="relative h-full overflow-auto rounded-[22px] bg-card-2 p-4">
      <div className="relative mx-auto w-fit overflow-hidden rounded-lg bg-white">
        <canvas ref={canvas} aria-label={`PDF page ${page}`} role="img" />
        {rects.map((r, i) => (
          <span key={i} className="pdf-hl" style={{ left: r.left - 2, top: r.top - 1, width: r.width + 4, height: r.height + 2 }} />
        ))}
      </div>
      {busy && (
        <span className="absolute top-6 right-6 rounded-full bg-card px-3 py-1 text-[12.5px] text-ink-2" aria-live="polite">
          Rendering page…
        </span>
      )}
    </div>
  )
}

/** Small lazily rendered page preview for the evidence strip. */
export function PdfThumb({ pdf, page, width = 72 }: { pdf: PDFDocumentProxy; page: number; width?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    let task: { cancel(): void; promise: Promise<void> } | null = null
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const p = await pdf.getPage(page)
      const vp = p.getViewport({ scale: (width * 2) / p.getViewport({ scale: 1 }).width })
      c.width = vp.width
      c.height = vp.height
      task = p.render({ canvas: c, viewport: vp })
      task.promise.catch(() => {})
    })
    io.observe(c)
    return () => {
      io.disconnect()
      task?.cancel()
    }
  }, [pdf, page, width])
  return <canvas ref={canvas} style={{ width, aspectRatio: '1 / 1.414' }} className="block rounded-md bg-white" aria-hidden />
}
