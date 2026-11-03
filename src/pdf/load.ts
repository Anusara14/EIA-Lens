import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'

GlobalWorkerOptions.workerSrc = workerUrl

export type { PDFDocumentProxy }

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  // pdf.js transfers the buffer to its worker; keep our own copy for the viewer.
  return getDocument({ data: new Uint8Array(data.slice(0)) }).promise
}
