import { describe, expect, it } from 'vitest'
import { assemble } from './assembler'
import { CPU, runProgram } from './cpu'
import { DISPLAY_BASE, STACK_TOP } from './isa'

describe('runProgram', () => {
  it('adds with 8-bit wraparound and sets carry', () => {
    expect(runProgram('LDI A, 250\nLDI B, 10\nADD A, B\nHLT').regs.A).toBe(4)
    expect(runProgram('LDI A, 250\nLDI B, 10\nADD A, B\nHLT').flags.C).toBe(true)
  })

  it('counts cycles: 1 per instruction, +1 per taken jump, HLT free', () => {
    expect(runProgram('LDI A, 3\nloop: SUB A, 1\nJNZ loop\nHLT').cycles).toBe(9)
    expect(runProgram('LDI A, 3\nloop: SUB A, 1\nJNZ loop\nHLT').steps).toBe(8)
  })

  it('sets Z on zero results and borrow on SUB/CMP', () => {
    const r = runProgram('LDI A, 5\nSUB A, 5\nHLT')
    expect(r.regs.A).toBe(0)
    expect(r.flags).toEqual({ Z: true, C: false })
    const borrow = runProgram('LDI A, 3\nCMP A, 4\nHLT')
    expect(borrow.regs.A).toBe(3)
    expect(borrow.flags).toEqual({ Z: false, C: true })
  })

  it('shifts through the carry flag', () => {
    expect(runProgram('LDI A, 0x81\nSHL A\nHLT')).toMatchObject({ regs: { A: 2 }, flags: { Z: false, C: true } })
    expect(runProgram('LDI A, 1\nSHR A\nHLT')).toMatchObject({ regs: { A: 0 }, flags: { Z: true, C: true } })
  })

  it('performs bitwise ops and clears carry', () => {
    const r = runProgram('LDI A, 0b1100\nLDI B, 0b1010\nAND A, B\nMOV C, A\nOR C, 1\nXOR B, B\nHLT')
    expect(r.regs).toMatchObject({ A: 0b1000, B: 0, C: 0b1001 })
    expect(r.flags).toEqual({ Z: true, C: false })
  })

  it('loads and stores through absolute and register-indirect addressing', () => {
    const r = runProgram('LDI A, 7\nSTA A, [0x80]\nLDI B, 0x80\nLDA C, [B]\nLDI D, 0x81\nSTA C, [D]\nLDA A, [0x81]\nHLT')
    expect(r.mem[0x80]).toBe(7)
    expect(r.mem[0x81]).toBe(7)
    expect(r.regs).toMatchObject({ A: 7, C: 7 })
  })

  it('pushes downward from the display base and pops back', () => {
    const r = runProgram('LDI A, 1\nLDI B, 2\nPUSH A\nPUSH B\nPOP C\nPOP D\nHLT')
    expect(r.regs).toMatchObject({ C: 2, D: 1 })
    expect(r.sp).toBe(STACK_TOP)
    expect(r.mem[STACK_TOP - 1]).toBe(1)
    expect(r.mem[STACK_TOP - 2]).toBe(2)
  })

  it('CALL pushes the return address and RET pops it', () => {
    const r = runProgram('CALL sub\nLDI B, 9\nHLT\nsub: LDI A, 4\nRET')
    expect(r.regs).toMatchObject({ A: 4, B: 9 })
    expect(r.halted).toBe(true)
    expect(r.cycles).toBe(1 + 1 + 1 + 1 + 1 + 1) // CALL(2) LDI RET(2) LDI
  })

  it('OUT appends to the output port', () => {
    expect(runProgram('LDI A, 72\nOUT A\nLDI A, 105\nOUT A\nHLT').output).toEqual([72, 105])
  })

  it('writes to the display window', () => {
    const r = runProgram(`LDI A, 0x80\nSTA A, [${DISPLAY_BASE}]\nHLT`)
    expect(r.mem[DISPLAY_BASE]).toBe(0x80)
  })

  it('stops with a fault on an illegal opcode', () => {
    const r = runProgram('.byte 0x99')
    expect(r.halted).toBe(true)
    expect(r.fault).toBe('Illegal opcode 0x99 at 0x00')
    expect(r.pc).toBe(0)
  })

  it('gives up after maxSteps on an infinite loop', () => {
    const r = runProgram('loop: JMP loop', 50)
    expect(r.halted).toBe(false)
    expect(r.steps).toBe(50)
    expect(r.cycles).toBe(100)
  })
})

describe('CPU.step', () => {
  it('reports what changed', () => {
    const cpu = new CPU()
    cpu.load(assemble('LDI A, 1\nSTA A, [0x20]\nADD A, 0\nOUT A\nHLT').bytes)
    expect(cpu.step()).toMatchObject({ pc: 0, regWrites: [0], memWrites: [], flagsChanged: false, cycles: 1 })
    expect(cpu.step()).toMatchObject({ pc: 3, memWrites: [0x20], regWrites: [] })
    expect(cpu.step()).toMatchObject({ pc: 6, regWrites: [0], flagsChanged: false })
    expect(cpu.step()).toMatchObject({ pc: 9, out: 1 })
    expect(cpu.step()).toMatchObject({ pc: 11, cycles: 0 })
    expect(cpu.halted).toBe(true)
    expect(cpu.step().op).toBeNull()
    expect(cpu.cycles).toBe(4)
  })

  it('wraps PC at 256', () => {
    const cpu = new CPU()
    cpu.mem[0xff] = 0x00 // NOP at the top of memory
    cpu.pc = 0xff
    cpu.step()
    expect(cpu.pc).toBe(0)
  })
})
