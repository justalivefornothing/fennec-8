import { useCallback, useEffect, useRef, useState } from 'react'
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

export type Status = 'idle' | 'ready' | 'running' | 'paused' | 'halted' | 'fault'

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
interface Meta {
  memStamp: Float64Array
  regStamp: number[]
  flagStamp: number
  steps: number
  lastOp: OpDef | null
}

const freshMeta = (): Meta => ({
  memStamp: new Float64Array(MEM_SIZE),
  regStamp: [0, 0, 0, 0],
  flagStamp: 0,
  steps: 0,
  lastOp: null,
})

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

function record(meta: Meta, r: StepResult, now: number): void {
  for (const a of r.memWrites) meta.memStamp[a] = now
  for (const i of r.regWrites) meta.regStamp[i] = now
  if (r.flagsChanged) meta.flagStamp = now
  if (r.op) {
    meta.lastOp = r.op
    meta.steps++
  }
}

function exampleSource(id: string): string {
  return EXAMPLES.find((e) => e.id === id)?.source ?? ''
}

export function useEmulator() {
  const cpuRef = useRef<CPU>(null)
  if (!cpuRef.current) cpuRef.current = new CPU()
  const metaRef = useRef<Meta>(null)
  if (!metaRef.current) metaRef.current = freshMeta()

  const [source, setSource] = useState(() => exampleSource(DEFAULT_EXAMPLE_ID))
  const [exampleId, setExampleId] = useState(DEFAULT_EXAMPLE_ID)
  const [assembled, setAssembled] = useState<Assembled | null>(null)
  const [assembledSource, setAssembledSource] = useState<string | null>(null)
  const [error, setError] = useState<AsmError | null>(null)
  const [running, setRunning] = useState(false)
  const [hz, setHz] = useState<number>(1000)
  const [snap, setSnap] = useState<Snapshot>(() => snapshotOf(cpuRef.current!, metaRef.current!))

  const publish = useCallback(() => setSnap(snapshotOf(cpuRef.current!, metaRef.current!)), [])

  /** Assemble `src` and load the result into a fresh CPU. */
  const assembleSource = useCallback(
    (src: string): Assembled | null => {
      setRunning(false)
      try {
        const result = assemble(src)
        cpuRef.current!.load(result.bytes)
        metaRef.current = freshMeta()
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
    [publish],
  )

  const doAssemble = useCallback(() => assembleSource(source), [assembleSource, source])

  // Assemble the bundled program on first load; `?autorun` also starts the clock.
  useEffect(() => {
    if (assembleSource(exampleSource(DEFAULT_EXAMPLE_ID)) && window.location.search.includes('autorun')) {
      setRunning(true)
    }
  }, [assembleSource])

  const reset = useCallback(() => {
    setRunning(false)
    const cpu = cpuRef.current!
    if (assembled) cpu.load(assembled.bytes)
    else cpu.reset()
    metaRef.current = freshMeta()
    publish()
  }, [assembled, publish])

  const step = useCallback(() => {
    setRunning(false)
    if (!assembled && !doAssemble()) return
    const cpu = cpuRef.current!
    if (cpu.halted) return
    record(metaRef.current!, cpu.step(), performance.now())
    publish()
  }, [assembled, doAssemble, publish])

  const run = useCallback(() => {
    if (!assembled && !doAssemble()) return
    if (cpuRef.current!.halted) return
    setRunning(true)
  }, [assembled, doAssemble])

  const pause = useCallback(() => setRunning(false), [])

  const toggleRun = useCallback(() => {
    if (running) pause()
    else run()
  }, [running, run, pause])

  const poke = useCallback(
    (addr: number, value: number) => {
      cpuRef.current!.mem[addr & 0xff] = value & 0xff
      metaRef.current!.memStamp[addr & 0xff] = performance.now()
      publish()
    },
    [publish],
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
    const cpu = cpuRef.current!
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
        record(metaRef.current!, r, now)
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
  }, [running, hz, publish])

  let status: Status = 'idle'
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
