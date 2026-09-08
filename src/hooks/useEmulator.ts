import { useCallback, useEffect, useState } from 'react'
import { AssembleError, assemble, type Assembled } from '../core/assembler'
import { CPU, type StepResult } from '../core/cpu'
import { DEFAULT_EXAMPLE_ID, EXAMPLES } from '../core/examples'
import { MEM_SIZE, type OpDef } from '../core/isa'

export interface Snapshot {
  regs: number[]
  pc: number
  sp: number
  z: boolean
  c: boolean
  cycles: number
  steps: number
  halted: boolean
  fault: string | null
  mem: Uint8Array
  output: number[]
  /** performance.now() of the last write to each address (0 = never). */
  memStamp: Float64Array
  regStamp: number[]
  flagStamp: number
  /** The instruction executed most recently. */
  lastOp: OpDef | null
}

export interface AsmError {
  line: number | null
  message: string
}

export type Status = 'idle' | 'error' | 'ready' | 'running' | 'paused' | 'halted' | 'fault'

export const HZ_OPTIONS = [
  { hz: 4, label: '4 Hz' },
  { hz: 30, label: '30 Hz' },
  { hz: 120, label: '120 Hz' },
  { hz: 500, label: '500 Hz' },
  { hz: 1000, label: '1 kHz' },
  { hz: 4000, label: '4 kHz' },
  { hz: 16000, label: '16 kHz' },
] as const

const MAX_STEPS_PER_FRAME = 50_000

/** Bookkeeping that lives outside the CPU: change timestamps for the UI flashes. */
class Meta {
  readonly memStamp = new Float64Array(MEM_SIZE)
  readonly regStamp = [0, 0, 0, 0]
  flagStamp = 0
  steps = 0
  lastOp: OpDef | null = null

  reset(): void {
    this.memStamp.fill(0)
    this.regStamp.fill(0)
    this.flagStamp = 0
    this.steps = 0
    this.lastOp = null
  }

  /** Note everything a step changed. */
  record(r: StepResult, now: number): void {
    for (const a of r.memWrites) this.memStamp[a] = now
    for (const i of r.regWrites) this.regStamp[i] = now
    if (r.flagsChanged) this.flagStamp = now
    if (r.op) {
      this.lastOp = r.op
      this.steps++
    }
  }

  touch(addr: number, now: number): void {
    this.memStamp[addr & 0xff] = now
  }
}

function snapshotOf(cpu: CPU, meta: Meta): Snapshot {
  return {
    regs: Array.from(cpu.regs),
    pc: cpu.pc,
    sp: cpu.sp,
    z: cpu.z,
    c: cpu.c,
    cycles: cpu.cycles,
    steps: meta.steps,
    halted: cpu.halted,
    fault: cpu.fault,
    mem: cpu.mem.slice(),
    output: [...cpu.output],
    memStamp: meta.memStamp.slice(),
    regStamp: [...meta.regStamp],
    flagStamp: meta.flagStamp,
    lastOp: meta.lastOp,
  }
}

function exampleSource(id: string): string {
  return EXAMPLES.find((e) => e.id === id)?.source ?? ''
}

const INITIAL_SOURCE = exampleSource(DEFAULT_EXAMPLE_ID)

export function useEmulator() {
  // The CPU and its bookkeeping are mutable instances that outlive renders;
  // they are only ever mutated from event handlers and the scheduler effect.
  const [cpu] = useState(() => new CPU())
  const [meta] = useState(() => new Meta())

  const [source, setSource] = useState(INITIAL_SOURCE)
  const [exampleId, setExampleId] = useState(DEFAULT_EXAMPLE_ID)
  // The bundled program is assembled and loaded on first render; `?autorun` starts the clock.
  const [assembled, setAssembled] = useState<Assembled | null>(() => {
    const result = assemble(INITIAL_SOURCE)
    cpu.load(result.bytes)
    return result
  })
  const [assembledSource, setAssembledSource] = useState<string | null>(INITIAL_SOURCE)
  const [error, setError] = useState<AsmError | null>(null)
  const [running, setRunning] = useState(() => window.location.search.includes('autorun'))
  const [hz, setHz] = useState<number>(1000)
  const [snap, setSnap] = useState<Snapshot>(() => snapshotOf(cpu, meta))

  const publish = useCallback(() => setSnap(snapshotOf(cpu, meta)), [cpu, meta])

  /** Assemble `src` and load the result into a fresh CPU. */
  const assembleSource = useCallback(
    (src: string): Assembled | null => {
      setRunning(false)
      try {
        const result = assemble(src)
        cpu.load(result.bytes)
        meta.reset()
        setAssembled(result)
        setAssembledSource(src)
        setError(null)
        publish()
        return result
      } catch (e) {
        const line = e instanceof AssembleError ? e.line : null
        const message = e instanceof Error ? e.message : String(e)
        setAssembled(null)
        setAssembledSource(null)
        setError({ line, message })
        return null
      }
    },
    [cpu, meta, publish],
  )

  const doAssemble = useCallback(() => assembleSource(source), [assembleSource, source])

  const reset = useCallback(() => {
    setRunning(false)
    if (assembled) cpu.load(assembled.bytes)
    else cpu.reset()
    meta.reset()
    publish()
  }, [assembled, cpu, meta, publish])

  const step = useCallback(() => {
    setRunning(false)
    if (!assembled && !doAssemble()) return
    if (cpu.halted) return
    meta.record(cpu.step(), performance.now())
    publish()
  }, [assembled, cpu, meta, doAssemble, publish])

  const run = useCallback(() => {
    if (!assembled && !doAssemble()) return
    if (cpu.halted) return
    setRunning(true)
  }, [assembled, cpu, doAssemble])

  const pause = useCallback(() => setRunning(false), [])

  const toggleRun = useCallback(() => {
    if (running) pause()
    else run()
  }, [running, run, pause])

  const poke = useCallback(
    (addr: number, value: number) => {
      cpu.poke(addr, value)
      meta.touch(addr, performance.now())
      publish()
    },
    [cpu, meta, publish],
  )

  const loadExample = useCallback(
    (id: string) => {
      const src = exampleSource(id)
      setExampleId(id)
      setSource(src)
      assembleSource(src)
    },
    [assembleSource],
  )

  // Scheduler: spend `hz` cycles per second, batched per animation frame.
  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    let budget = 0
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000
      last = now
      budget = Math.min(budget + hz * dt, hz)
      let guard = 0
      while (budget >= 1 && !cpu.halted && guard++ < MAX_STEPS_PER_FRAME) {
        const r = cpu.step()
        budget -= r.cycles
        meta.record(r, now)
      }
      publish()
      if (cpu.halted) {
        setRunning(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, hz, cpu, meta, publish])

  let status: Status = error ? 'error' : 'idle'
  if (assembled) {
    if (snap.fault) status = 'fault'
    else if (snap.halted) status = 'halted'
    else if (running) status = 'running'
    else if (snap.steps > 0) status = 'paused'
    else status = 'ready'
  }

  return {
    source,
    setSource,
    exampleId,
    loadExample,
    assembled,
    dirty: assembledSource !== null && assembledSource !== source,
    error,
    snap,
    running,
    status,
    hz,
    setHz,
    assemble: doAssemble,
    run,
    pause,
    toggleRun,
    step,
    reset,
    poke,
  }
}

export type Emulator = ReturnType<typeof useEmulator>
