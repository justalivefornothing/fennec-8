import { useEffect, useRef } from 'react'
import type { Assembled } from '../core/assembler'
import { hex2 } from '../core/isa'
import { Panel } from './Panel'

interface Props {
  assembled: Assembled | null
  pc: number
}

/** Address / bytes / source, with the instruction at PC lit. */
export function Listing({ assembled, pc }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeLine = assembled?.lineAt[pc]

  useEffect(() => {
    const box = scrollRef.current
    const row = box?.querySelector<HTMLElement>('[data-active="true"]')
    if (!box || !row) return
    // Keep the lit row inside the scroll box without touching the page scroll.
    const b = box.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    if (r.top < b.top || r.bottom > b.bottom) {
      box.scrollTop += r.top - b.top - b.height / 2 + r.height / 2
    }
  }, [activeLine])

  const size = assembled?.bytes.length ?? 0
  return (
    <Panel
      title="Listing"
      flush
      aside={assembled && <span className="font-mono">{size} bytes · {assembled.listing.filter((l) => l.bytes.length).length} lines</span>}
    >
      <div ref={scrollRef} className="relative max-h-[280px] overflow-auto rounded-b-md bg-umber-deep font-mono text-xs leading-5">
        {!assembled ? (
          <p className="px-3 py-6 text-center text-sand/40">Assemble to see addresses and bytes here.</p>
        ) : (
          <table className="w-full border-collapse whitespace-pre">
            <tbody>
              {assembled.listing.map((l) => {
                const active = l.line === activeLine
                return (
                  <tr
                    key={l.line}
                    data-active={active ? 'true' : undefined}
                    className={active ? 'bg-ember text-sand' : 'text-sand/85 hover:bg-umber-light/50'}
                  >
                    <td className={`w-8 select-none pr-1 pl-2 text-right ${active ? 'text-sand/70' : 'text-sand/35'}`}>
                      {l.line}
                    </td>
                    <td className={`w-8 pr-2 ${active ? 'text-sand' : 'text-ember-glow'}`}>
                      {l.address !== null ? hex2(l.address) : ''}
                    </td>
                    <td className={`w-20 pr-2 ${active ? 'text-sand/80' : 'text-sand/55'}`}>{l.bytes.map(hex2).join(' ')}</td>
                    <td className="pr-3">{l.source}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  )
}
