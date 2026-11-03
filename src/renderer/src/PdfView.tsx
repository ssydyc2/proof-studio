import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentLoadingTask, type RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

type Menu = { x: number; y: number; text: string }

export function PdfView({
  dataUrl,
  onLeanComponent
}: {
  dataUrl: string
  onLeanComponent: (text: string) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const pages = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [failureUrl, setFailureUrl] = useState<string | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const failed = failureUrl === dataUrl

  useEffect(() => {
    const host = scroller.current
    if (!host) return
    const observer = new ResizeObserver(() => {
      const next = Math.floor(host.clientWidth)
      setWidth((current) => (Math.abs(current - next) > 8 ? next : current))
    })
    observer.observe(host)
    setWidth(Math.floor(host.clientWidth))
    return () => observer.disconnect()
  }, [failed])

  useEffect(() => {
    const root = pages.current
    if (!root || width < 80) return
    let cancelled = false
    const jobs: Array<{ cancel: () => void }> = []
    let loading: PDFDocumentLoadingTask | null = null
    root.replaceChildren()

    async function draw() {
      loading = getDocument({ data: pdfBytes(dataUrl) })
      const doc = await loading.promise
      if (cancelled) return
      const pageWidth = Math.max(width - 32, 240)
      for (let number = 1; number <= doc.numPages; number += 1) {
        if (cancelled) return
        const page = await doc.getPage(number)
        if (cancelled) return
        const unscaled = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: pageWidth / unscaled.width })
        const wrap = document.createElement('div')
        wrap.className = 'pdf-page'
        wrap.style.width = `${viewport.width}px`
        wrap.style.height = `${viewport.height}px`
        wrap.style.setProperty('--scale-factor', String(viewport.scale))
        wrap.style.setProperty('--user-unit', String(page.userUnit || 1))
        const canvas = document.createElement('canvas')
        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        const text = document.createElement('div')
        text.className = 'textLayer'
        wrap.append(canvas, text)
        root?.append(wrap)
        const task: RenderTask = page.render({
          canvas,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0]
        })
        const layer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container: text,
          viewport
        })
        jobs.push(task, layer)
        await Promise.all([task.promise, layer.render()])
      }
    }

    void draw().catch(() => {
      if (!cancelled) setFailureUrl(dataUrl)
    })
    return () => {
      cancelled = true
      for (const job of jobs) job.cancel()
      void loading?.destroy()
    }
  }, [dataUrl, width])

  useEffect(() => {
    if (!menu) return
    function close() {
      setMenu(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu])

  if (failed) return <embed className="pdf" type="application/pdf" src={dataUrl} />

  return (
    <div
      className="pdf-view"
      ref={scroller}
      onContextMenu={(event) => {
        const root = scroller.current
        const text = root ? selectedPdfText(root) : ''
        if (!text) return
        event.preventDefault()
        setMenu({
          x: Math.min(event.clientX, window.innerWidth - 180),
          y: Math.min(event.clientY, window.innerHeight - 48),
          text
        })
      }}
    >
      <div ref={pages} />
      {menu && (
        <div className="lean-menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              const text = menu.text
              setMenu(null)
              onLeanComponent(text)
            }}
          >
            Lean component
          </button>
        </div>
      )}
    </div>
  )
}

function selectedPdfText(root: HTMLElement): string {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return ''
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return ''
  return selection.toString().replace(/\u00a0/g, ' ').trim()
}

function pdfBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const binary = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}
