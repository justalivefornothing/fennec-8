import { useRef, type KeyboardEvent } from 'react'
import type { AsmError } from '../hooks/useEmulator'
import { Panel } from './Panel'

interface Props {
  source: string
  onChange: (s: string) => void
  onAssemble: () => void
  error: AsmError | null
  dirty: boolean
}

export function Editor({ source, onChange, onAssemble, error, dirty }: Props) {
  const gutterRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const lineCount = source.split('\n').length

  const jumpToError = () => {
    const ta = textRef.current
    if (!ta || !error?.line) return
    const lines = source.split('\n')
    const start = lines.slice(0, error.line - 1).reduce((n, l) => n + l.length + 1, 0)
    ta.focus()
    ta.setSelectionRange(start, start + (lines[error.line - 1]?.length ?? 0))
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onAssemble()
    } else if (e.key === 'Tab') {
      // Insert spaces instead of leaving the editor.
      e.preventDefault()
      const ta = e.currentTarget
      const { selectionStart: s, selectionEnd: en } = ta
      const next = source.slice(0, s) + '    ' + source.slice(en)
      onChange(next)
      requestAnimationFrame(() => ta.setSelectionRange(s + 4, s + 4))
    }
  }

  return (
    <Panel
      title="Source"
      flush
      className="flex-1"
      aside={
        <>
          {dirty && <span className="text-ember">modified — assemble to reload</span>}
          <span className="hidden font-mono sm:inline">Ctrl+Enter assembles</span>
        </>
      }
    >
      <div className="flex h-full flex-col">
        <div className="relative flex min-h-[300px] flex-1 overflow-hidden rounded-b-md bg-umber-deep font-mono text-[13px] leading-5">
          <div
            ref={gutterRef}
            aria-hidden
            className="absolute inset-y-0 left-0 w-10 select-none overflow-hidden border-r border-umber-light py-3 text-right text-sand/35"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className={`pr-2 ${error?.line === i + 1 ? 'bg-ember text-sand' : ''}`}>
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            ref={textRef}
            className="min-h-[300px] flex-1 resize-none bg-transparent py-3 pr-3 pl-13 text-sand caret-ember-bright outline-none placeholder:text-sand/30"
            value={source}
            onChange={(e) => onChange(e.target.value)}
            onScroll={(e) => {
              if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop
            }}
            onKeyDown={onKey}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            aria-label="Assembly source"
            aria-invalid={error ? true : undefined}
            placeholder={'; write Fennec-8 assembly here\nLDI A, 1\nOUT A\nHLT'}
          />
        </div>
        {error && (
          <button
            type="button"
            onClick={jumpToError}
            className="flex w-full items-start gap-2 rounded-b-md bg-ember px-3 py-2 text-left font-mono text-xs text-sand outline-none hover:bg-ember-bright hover:text-umber-deep focus-visible:ring-2 focus-visible:ring-sand"
          >
            <span className="font-display font-bold uppercase tracking-wider">error</span>
            <span>{error.message}</span>
          </button>
        )}
      </div>
    </Panel>
  )
}
