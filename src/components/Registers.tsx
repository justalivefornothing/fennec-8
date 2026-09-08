import { useState } from 'react'
import { disassembleAt } from '../core/disassembler'
import { REGISTERS, bin8, hex2 } from '../core/isa'
import type { Snapshot } from '../hooks/useEmulator'
import { Panel, Screen } from './Panel'

type View = 'dec' | 'hex' | 'bin'

function format(v: number, view: View): { text: string; ghost: string } {
  switch (view) {
    case 'dec':
      return { text: v.toString(10).padStart(3, ' '), ghost: '888' }
    case 'hex':
      return { text: hex2(v), ghost: '88' }
    case 'bin':
      return { text: bin8(v), ghost: '88888888' }
  }
}

/** A seven-segment style readout: unlit ghost "8"s behind the lit digits. */
function Lcd({
  label,
  text,
  ghost,
  stamp,
  size = 'lg',
}: {
  label: string
  text: string
  ghost: string
  stamp: number
  size?: 'lg' | 'sm'
}) {
  const digits = size === 'lg' ? 'text-[26px] leading-none' : 'text-[19px] leading-none'
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">{label}</span>
      <Screen className="px-2 py-1.5">
        <div key={stamp} className={`lcd relative font-lcd ${digits} ${stamp > 0 ? 'lcd-flash' : ''}`}>
          <span aria-hidden className="absolute inset-0 text-ember/10 whitespace-pre">
            {ghost}
          </span>
          <span className="relative whitespace-pre text-ember-bright">{text}</span>
        </div>
      </Screen>
    </div>
  )
}

function Led({ label, on, stamp }: { label: string; on: boolean; stamp: number }) {
  return (
    <div className="flex items-center gap-2" title={`${label} flag ${on ? 'set' : 'clear'}`}>
      <span
        key={stamp}
        className={`size-3 rounded-full border transition-colors ${
          on
            ? 'border-ember-glow bg-ember-bright shadow-[0_0_8px_2px_rgba(255,138,61,0.7)]'
            : 'border-umber-light bg-umber-deep'
        } ${stamp > 0 ? 'led-flash' : ''}`}
      />
      <span className="font-display text-xs font-bold tracking-wider">{label}</span>
    </div>
  )
}

const VIEWS: View[] = ['dec', 'hex', 'bin']

export function Registers({ snap }: { snap: Snapshot }) {
  const [view, setView] = useState<View>('dec')
  const next = disassembleAt(snap.mem, snap.pc).text
  const cols = view === 'bin' ? 'grid-cols-2' : 'grid-cols-4'
  return (
    <Panel
      title="CPU"
      aside={
        <div className="flex rounded-sm border border-sand-deep" role="group" aria-label="Register view">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember ${
                view === v ? 'bg-ink text-sand' : 'text-ink-soft hover:bg-sand-dark'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      }
    >
      <div className={`grid ${cols} gap-2`}>
        {REGISTERS.map((name, i) => {
          const f = format(snap.regs[i], view)
          return <Lcd key={name} label={name} text={f.text} ghost={f.ghost} stamp={snap.regStamp[i]} />
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Lcd label="PC" text={hex2(snap.pc)} ghost="88" stamp={0} size="sm" />
        <Lcd label="SP" text={hex2(snap.sp)} ghost="88" stamp={0} size="sm" />
        <Lcd label="Cycles" text={String(snap.cycles).padStart(6, ' ')} ghost="888888" stamp={0} size="sm" />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4">
          <Led label="Z" on={snap.z} stamp={snap.flagStamp} />
          <Led label="C" on={snap.c} stamp={snap.flagStamp} />
        </div>
        <div className="min-w-0 truncate font-mono text-xs text-ink-soft" title="Next instruction at PC">
          next <span className="text-ink">{next}</span>
          {snap.lastOp && (
            <>
              {' · '}last <span className="text-ink">{snap.lastOp.mnemonic}</span>
            </>
          )}
        </div>
      </div>
    </Panel>
  )
}
