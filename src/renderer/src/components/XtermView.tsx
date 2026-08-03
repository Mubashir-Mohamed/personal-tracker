import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export interface XtermHandle {
  write: (data: string) => void
  clear: () => void
  focus: () => void
}

interface XtermViewProps {
  onData: (data: string) => void
  onResize: (cols: number, rows: number) => void
}

const XtermView = forwardRef<XtermHandle, XtermViewProps>(function XtermView(
  { onData, onResize },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  // Kept in refs so the mount effect below (which must run only once) always calls the
  // latest callback the parent passed, instead of capturing a stale closure.
  const onDataRef = useRef(onData)
  const onResizeRef = useRef(onResize)
  useEffect(() => {
    onDataRef.current = onData
  }, [onData])
  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useImperativeHandle(
    ref,
    () => ({
      write: (data: string) => termRef.current?.write(data),
      clear: () => termRef.current?.clear(),
      focus: () => termRef.current?.focus()
    }),
    []
  )

  useEffect(() => {
    if (!containerRef.current) return

    const styles = getComputedStyle(document.documentElement)
    const cssVar = (name: string, fallback: string): string =>
      styles.getPropertyValue(name).trim() || fallback

    const term = new Terminal({
      cursorBlink: true,
      fontFamily:
        "'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: cssVar('--bg', '#0a0e14'),
        foreground: cssVar('--text-primary', '#e7f3ec'),
        cursor: cssVar('--accent', '#3dff9a'),
        cursorAccent: cssVar('--bg', '#0a0e14'),
        selectionBackground: cssVar('--accent-soft', 'rgba(61, 255, 154, 0.14)'),
        red: cssVar('--danger', '#ff6b7a'),
        black: cssVar('--bg-elevated', '#141c27'),
        brightBlack: cssVar('--text-tertiary', '#6e8296')
      }
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()
    termRef.current = term

    const dataDisposable = term.onData((data) => onDataRef.current(data))
    onResizeRef.current(term.cols, term.rows)

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit()
      } catch {
        // container has no layout box yet (e.g. mid-transition); next observation will retry.
      }
      onResizeRef.current(term.cols, term.rows)
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      dataDisposable.dispose()
      term.dispose()
      termRef.current = null
    }
  }, [])

  return <div className="terminal-shell" ref={containerRef} />
})

export default XtermView
