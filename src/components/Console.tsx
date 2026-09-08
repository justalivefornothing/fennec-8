import { useEffect, useRef, useState } from 'react'
import { hex2 } from '../core/isa'
import { Panel, Screen } from './Panel'

const printable = (b: number) => b >= 0x20 && b <= 0x7e

/** Everything written with OUT, newest at the end. */
export function Console({ output }: { output: number[] }) {
  const [asText, setAsText] = useState(false)
  const screenRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = screenRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [output.length, asText])

  return (
    <Panel
      title="OUT port"
      aside={
        <>
          <span className="font-mono">
            {output.length} byte{output.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setAsText((v) => !v)}
            aria-pressed={asText}
            className="rounded-sm border border-sand-deep px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-ink-soft outline-none transition-colors hover:bg-sand-dark focus-visible:ring-2 focus-visible:ring-ember"
          >
            {asText ? 'as text' : 'as bytes'}
          </button>
        </>
      }
    >
      <div ref={screenRef} className="max-h-28 overflow-y-auto">
        <Screen className="min-h-12 px-3 py-2">
          {output.length === 0 ? (
            <p className="font-mono text-xs text-sand/40">Nothing yet — OUT writes bytes here.</p>
          ) : asText ? (
            <p className="font-lcd text-xl leading-7 tracking-wide text-ember-bright break-all">
              {output.map((b) => (printable(b) ? String.fromCharCode(b) : '·')).join('')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {output.map((b, i) => (
                <span
                  key={i}
                  className="rounded-[3px] border border-ember/40 px-1.5 py-0.5 font-lcd text-sm leading-4 text-ember-bright"
                  title={`0x${hex2(b)}${printable(b) ? ` '${String.fromCharCode(b)}'` : ''}`}
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </Screen>
      </div>
    </Panel>
  )
}
