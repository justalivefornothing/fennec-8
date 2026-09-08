import { useEffect, useRef } from 'react'
import { Console } from './components/Console'
import { Controls } from './components/Controls'
import { Display } from './components/Display'
import { Editor } from './components/Editor'
import { IsaReference } from './components/IsaReference'
import { Listing } from './components/Listing'
import { MemoryGrid } from './components/MemoryGrid'
import { Registers } from './components/Registers'
import { useEmulator } from './hooks/useEmulator'

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT')

export default function App() {
  const emu = useEmulator()
  const emuRef = useRef(emu)
  useEffect(() => {
    emuRef.current = emu
  })

  // Single-key shortcuts when focus is not inside a form control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const live = emuRef.current
      switch (e.key.toLowerCase()) {
        case 'a':
          live.assemble()
          break
        case 'r':
          live.toggleRun()
          break
        case 's':
          live.step()
          break
        case 'x':
          live.reset()
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const programSize = emu.assembled?.bytes.length ?? 0

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-3 p-3 sm:p-4">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-1">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-3xl font-bold tracking-[0.12em] text-sand">
            FENNEC<span className="text-ember-bright">-8</span>
          </h1>
          <p className="hidden text-xs text-sand/60 sm:block">
            two-pass assembler · cycle-stepped 8-bit CPU · 256 B RAM · 16×16 memory-mapped display
          </p>
        </div>
        <a
          className="font-mono text-xs text-sand/50 underline-offset-4 hover:text-sand hover:underline focus-visible:outline-2 focus-visible:outline-ember-bright"
          href="https://github.com/goonerlogy-cyber/fennec-8"
        >
          source
        </a>
      </header>

      <div className="rounded-md border border-sand-deep/40 bg-umber-light/60 p-2">
        <Controls emu={emu} />
      </div>

      <main className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Editor
            source={emu.source}
            onChange={emu.setSource}
            onAssemble={emu.assemble}
            error={emu.error}
            dirty={emu.dirty}
          />
          <Listing assembled={emu.assembled} pc={emu.snap.pc} follow={!emu.running || emu.hz <= 120} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Registers snap={emu.snap} />
          <Display mem={emu.snap.mem} />
          <Console output={emu.snap.output} />
        </div>
        <div className="flex min-w-0 flex-col gap-3 md:col-span-2 xl:col-span-1">
          <MemoryGrid snap={emu.snap} programSize={programSize} onPoke={emu.poke} />
          <IsaReference />
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 py-1 font-mono text-[11px] text-sand/40">
        <span>
          Keys: <kbd className="text-sand/70">A</kbd> assemble · <kbd className="text-sand/70">R</kbd> run/pause ·{' '}
          <kbd className="text-sand/70">S</kbd> step · <kbd className="text-sand/70">X</kbd> reset · arrows move in memory,
          Enter edits a byte
        </span>
        <span>1 cycle per instruction, +1 for a taken jump. MIT.</span>
      </footer>
    </div>
  )
}
