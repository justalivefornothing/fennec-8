import { EXAMPLES } from '../core/examples'
import { HZ_OPTIONS, type Emulator, type Status } from '../hooks/useEmulator'

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Idle',
  ready: 'Ready',
  running: 'Running',
  paused: 'Paused',
  halted: 'Halted',
  fault: 'Fault',
}

const STATUS_TONE: Record<Status, string> = {
  idle: 'bg-sand-deep/50 text-ink-soft',
  ready: 'bg-sand-dark text-ink',
  running: 'bg-ember text-sand',
  paused: 'bg-ember/60 text-sand',
  halted: 'bg-umber-light text-sand',
  fault: 'bg-red-800 text-sand',
}

const BTN =
  'inline-flex h-9 items-center gap-2 rounded-sm border px-3 font-display text-sm font-semibold uppercase tracking-wider transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ember-bright focus-visible:ring-offset-2 focus-visible:ring-offset-umber disabled:cursor-not-allowed disabled:opacity-40'
const BTN_SAND = `${BTN} border-sand-deep bg-sand text-ink hover:bg-sand-dark active:translate-y-px`
const BTN_EMBER = `${BTN} border-ember-bright/60 bg-ember text-sand hover:bg-ember-bright hover:text-umber-deep active:translate-y-px`

function Key({ k }: { k: string }) {
  return (
    <kbd className="rounded-[3px] border border-current/40 px-1 font-mono text-[10px] leading-4 opacity-70">{k}</kbd>
  )
}

const SELECT =
  'h-9 rounded-sm border border-sand-deep bg-umber-deep px-2 font-mono text-sm text-sand outline-none hover:border-sand focus-visible:ring-2 focus-visible:ring-ember-bright'

export function Controls({ emu }: { emu: Emulator }) {
  const { status, running, snap } = emu
  const canStep = status !== 'halted' && status !== 'fault'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-sand/70">
        <span className="hidden sm:inline">Program</span>
        <select
          className={SELECT}
          value={emu.exampleId}
          onChange={(e) => emu.loadExample(e.target.value)}
          aria-label="Example program"
        >
          {EXAMPLES.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className={BTN_SAND} onClick={emu.assemble} title="Assemble (A, or Ctrl+Enter in the editor)">
        Assemble <Key k="A" />
      </button>
      <button
        type="button"
        className={running ? BTN_SAND : BTN_EMBER}
        onClick={emu.toggleRun}
        disabled={!canStep}
        title={running ? 'Pause (R)' : 'Run (R)'}
      >
        {running ? 'Pause' : 'Run'} <Key k="R" />
      </button>
      <button type="button" className={BTN_SAND} onClick={emu.step} disabled={!canStep} title="Step one instruction (S)">
        Step <Key k="S" />
      </button>
      <button type="button" className={BTN_SAND} onClick={emu.reset} title="Reset CPU and memory (X)">
        Reset <Key k="X" />
      </button>

      <label className="flex items-center gap-2 text-xs text-sand/70">
        <span className="hidden sm:inline">Clock</span>
        <select
          className={SELECT}
          value={emu.hz}
          onChange={(e) => emu.setHz(Number(e.target.value))}
          aria-label="Clock speed"
        >
          {HZ_OPTIONS.map((o) => (
            <option key={o.hz} value={o.hz}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <span
        className={`ml-auto inline-flex h-9 items-center gap-2 rounded-sm px-3 font-display text-xs font-bold uppercase tracking-wider ${STATUS_TONE[status]}`}
        role="status"
        aria-live="polite"
      >
        <span className={`size-2 rounded-full ${running ? 'animate-pulse bg-sand' : 'bg-current opacity-60'}`} />
        {STATUS_LABEL[status]}
        {snap.fault && <span className="font-mono text-[11px] normal-case tracking-normal opacity-90">— {snap.fault}</span>}
      </span>
    </div>
  )
}
