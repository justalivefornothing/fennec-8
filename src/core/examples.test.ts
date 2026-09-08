import { describe, expect, it } from 'vitest'
import { assemble } from './assembler'
import { CPU, runProgram } from './cpu'
import { EXAMPLES } from './examples'
import { DISPLAY_BASE, DISPLAY_SIZE } from './isa'

const src = (id: string) => EXAMPLES.find((e) => e.id === id)!.source

describe('bundled examples', () => {
  it('all assemble and fit below the stack', () => {
    for (const ex of EXAMPLES) expect(assemble(ex.source).bytes.length).toBeLessThan(0xc0)
  })

  it('counter prints 0..9', () => {
    const r = runProgram(src('counter'))
    expect(r.output).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(r.halted).toBe(true)
  })

  it('multiply computes 42 into C and RAM', () => {
    const r = runProgram(src('multiply'))
    expect(r.regs.C).toBe(42)
    expect(r.output).toEqual([42])
    expect(r.mem[assemble(src('multiply')).labels.result]).toBe(42)
  })

  it('fibonacci stops before overflowing a byte', () => {
    expect(runProgram(src('fibonacci')).output).toEqual([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233])
  })

  it('string print emits the text', () => {
    const r = runProgram(src('string'))
    expect(String.fromCharCode(...r.output)).toBe('HELLO, FENNEC!')
  })

  it('bouncing pixel keeps exactly one pixel lit and visits both walls', () => {
    const cpu = new CPU()
    cpu.load(assemble(src('bounce')).bytes)
    const litCount = () => {
      let n = 0
      for (let i = 0; i < DISPLAY_SIZE; i++) {
        let b = cpu.mem[DISPLAY_BASE + i]
        while (b) {
          n += b & 1
          b >>= 1
        }
      }
      return n
    }
    const seenX = new Set<number>()
    const labels = assemble(src('bounce')).labels
    for (let i = 0; i < 20_000 && !cpu.halted; i++) {
      cpu.step()
      if (cpu.pc === labels.loop) {
        expect(litCount()).toBe(1)
        seenX.add(cpu.mem[labels.x])
      }
    }
    expect(cpu.halted).toBe(false)
    expect(seenX.has(0)).toBe(true)
    expect(seenX.has(15)).toBe(true)
    expect(Math.max(...seenX)).toBe(15)
  })
})
