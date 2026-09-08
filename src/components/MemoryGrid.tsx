import { useState, type KeyboardEvent } from 'react'
import { disassembleAt } from '../core/disassembler'
import { DISPLAY_BASE, MEM_SIZE, OP_BY_CODE, hex2 } from '../core/isa'
import type { Snapshot } from '../hooks/useEmulator'
import { Panel } from './Panel'

interface Props {
  snap: Snapshot
  programSize: number
  onPoke: (addr: number, value: number) => void
}

const HEX = '0123456789ABCDEF'
const cellId = (addr: number) => `mem-${addr}`

export function MemoryGrid({ snap, programSize, onPoke }: Props) {
  const [editing, setEditing] = useState<{ addr: number; text: string } | null>(null)
  const { mem, memStamp, pc, sp } = snap
  const opAtPc = OP_BY_CODE[mem[pc]]
  const opEnd = pc + (opAtPc?.size ?? 1)

  const commit = () => {
    if (!editing) return
    const { addr, text } = editing
    const v = parseInt(text, 16)
    if (text.trim() && !Number.isNaN(v) && v >= 0 && v <= 0xff) onPoke(addr, v)
    setEditing(null)
    requestAnimationFrame(() => document.getElementById(cellId(addr))?.focus())
  }

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const addr = Number(target.dataset.addr)
    if (Number.isNaN(addr) || target.tagName === 'INPUT') return
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 16, ArrowUp: -16 }
    const delta = moves[e.key]
    if (delta !== undefined) {
      e.preventDefault()
      document.getElementById(cellId((addr + delta + MEM_SIZE) % MEM_SIZE))?.focus()
    }
  }

  const cells = []
  for (let addr = 0; addr < MEM_SIZE; addr++) {
    if (addr % 16 === 0) {
      cells.push(
        <div key={`row-${addr}`} className="mem-head">
          {hex2(addr)}
        </div>,
      )
    }
    const stamp = memStamp[addr]
    const isPc = addr === pc
    const inOp = addr > pc && addr < opEnd
    const isDisplay = addr >= DISPLAY_BASE
    const isProgram = addr < programSize
    const v = mem[addr]

    if (editing?.addr === addr) {
      cells.push(
        <input
          key={`${addr}-edit`}
          id={`${cellId(addr)}-input`}
          className="mem-cell h-full w-full bg-ember-bright text-center text-umber-deep outline-none"
          value={editing.text}
          maxLength={2}
          autoFocus
          spellCheck={false}
          aria-label={`Edit byte at ${hex2(addr)}`}
          onChange={(e) => setEditing({ addr, text: e.target.value.replace(/[^0-9a-fA-F]/g, '') })}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            else if (e.key === 'Escape') {
              setEditing(null)
              requestAnimationFrame(() => document.getElementById(cellId(addr))?.focus())
            }
          }}
        />,
      )
      continue
    }

    let tone = 'text-ink'
    if (isPc) tone = 'bg-ember text-sand font-semibold'
    else if (inOp) tone = 'bg-ember/25 text-ink'
    else if (isDisplay) tone = v ? 'bg-umber-light text-ember-glow' : 'bg-sand-dark/70 text-ink-soft/60'
    else if (v === 0) tone = isProgram ? 'text-ink-soft' : 'text-ink-soft/45'

    const title = isProgram
      ? `${hex2(addr)}: ${disassembleAt(mem, addr).text}`
      : isDisplay
        ? `${hex2(addr)}: display row ${(addr - DISPLAY_BASE) >> 1}, ${addr & 1 ? 'right' : 'left'} half`
        : `${hex2(addr)}: ${v}`

    cells.push(
      <button
        type="button"
        key={`${addr}-${stamp}`}
        id={cellId(addr)}
        data-addr={addr}
        className={`mem-cell ${tone} ${stamp > 0 ? 'flash' : ''} ${addr === sp ? 'mem-sp' : ''}`}
        title={title}
        aria-label={`Byte ${hex2(addr)} = ${v}`}
        onClick={() => setEditing({ addr, text: hex2(v) })}
      >
        {hex2(v)}
      </button>,
    )
  }

  return (
    <Panel
      title="Memory"
      aside={
        <span className="hidden font-mono sm:inline">
          {programSize} B program · stack ↓ {hex2(DISPLAY_BASE - 1)} · click a byte to edit
        </span>
      }
    >
      <div
        className="grid select-none gap-px font-mono"
        style={{ gridTemplateColumns: 'auto repeat(16, minmax(0, 1fr))' }}
        onKeyDown={onGridKey}
        role="grid"
        aria-label="256 bytes of memory"
      >
        <div className="mem-head" />
        {HEX.split('').map((h) => (
          <div key={`col-${h}`} className="mem-head text-center">
            {h}
          </div>
        ))}
        {cells}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ink-soft">
        <Legend swatch="bg-ember" label="PC" />
        <Legend swatch="bg-ember/25" label="operands" />
        <Legend swatch="bg-ember-bright" label="just written" />
        <Legend swatch="bg-sand-dark border border-ink" label="SP" />
        <Legend swatch="bg-umber-light" label="display" />
      </div>
    </Panel>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block size-2.5 rounded-[2px] ${swatch}`} />
      {label}
    </span>
  )
}
