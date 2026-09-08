/**
 * Fennec-8 CPU: 4 registers, PC, SP, Z/C flags, 256 bytes of RAM whose upper
 * 32 bytes back a 16x16 one-bit display.
 *
 * Cycle model: every instruction costs 1 cycle; a control transfer that
 * actually reloads PC (JMP, taken JZ/JNZ/JC, CALL, RET) costs 1 more; HLT stops
 * the clock and costs nothing.
 */
import { assemble } from './assembler'
import { MEM_SIZE, OP_BY_CODE, STACK_TOP, hex2, type OpDef } from './isa'

export interface StepResult {
  /** PC of the executed instruction. */
  pc: number
  op: OpDef | null
  cycles: number
  memWrites: number[]
  regWrites: number[]
  flagsChanged: boolean
  out: number | null
}

export class CPU {
  readonly mem = new Uint8Array(MEM_SIZE)
  readonly regs = new Uint8Array(4)
  pc = 0
  sp = STACK_TOP
  z = false
  c = false
  halted = false
  cycles = 0
  /** Set when the CPU stops on an illegal opcode. */
  fault: string | null = null
  readonly output: number[] = []

  reset(): void {
    this.mem.fill(0)
    this.regs.fill(0)
    this.pc = 0
    this.sp = STACK_TOP
    this.z = false
    this.c = false
    this.halted = false
    this.cycles = 0
    this.fault = null
    this.output.length = 0
  }

  /** Reset, then copy a program into memory starting at address 0. */
  load(program: Uint8Array): void {
    this.reset()
    this.mem.set(program.subarray(0, MEM_SIZE), 0)
  }

  /** Front-panel write: change one byte without touching CPU state. */
  poke(addr: number, value: number): void {
    this.mem[addr & 0xff] = value & 0xff
  }

  private fetch(): number {
    const b = this.mem[this.pc]
    this.pc = (this.pc + 1) & 0xff
    return b
  }

  private setZC(result: number, carry: boolean): number {
    const v = result & 0xff
    this.z = v === 0
    this.c = carry
    return v
  }

  /** Execute one instruction. Returns what changed so a UI can flash it. */
  step(): StepResult {
    const start = this.pc
    const res: StepResult = {
      pc: start,
      op: null,
      cycles: 0,
      memWrites: [],
      regWrites: [],
      flagsChanged: false,
      out: null,
    }
    if (this.halted) return res

    const opcode = this.fetch()
    const def = OP_BY_CODE[opcode]
    if (!def) {
      this.halted = true
      this.fault = `Illegal opcode 0x${hex2(opcode)} at 0x${hex2(start)}`
      this.pc = start
      return res
    }
    res.op = def
    const z0 = this.z
    const c0 = this.c
    let cost = 1

    const R = this.regs
    const write = (addr: number, v: number) => {
      this.mem[addr & 0xff] = v & 0xff
      res.memWrites.push(addr & 0xff)
    }
    const setReg = (r: number, v: number) => {
      R[r] = v & 0xff
      res.regWrites.push(r)
    }
    const push = (v: number) => {
      this.sp = (this.sp - 1) & 0xff
      write(this.sp, v)
    }
    const pop = () => {
      const v = this.mem[this.sp]
      this.sp = (this.sp + 1) & 0xff
      return v
    }
    const jump = (addr: number) => {
      this.pc = addr & 0xff
      cost++
    }

    // Operand fetch by form, then execute by mnemonic.
    let r = 0
    let r2 = 0
    let v = 0
    switch (def.form) {
      case 'none':
        break
      case 'reg':
        r = this.fetch() & 3
        break
      case 'addr':
        v = this.fetch()
        break
      case 'reg,reg':
      case 'reg,ind':
        r = this.fetch() & 3
        r2 = this.fetch() & 3
        break
      case 'reg,imm':
      case 'reg,mem':
        r = this.fetch() & 3
        v = this.fetch()
        break
    }
    // Second ALU operand: register or immediate.
    const b = def.form === 'reg,reg' ? R[r2] : v

    switch (def.mnemonic) {
      case 'NOP':
        break
      case 'LDI':
        setReg(r, v)
        break
      case 'LDA':
        setReg(r, this.mem[def.form === 'reg,ind' ? R[r2] : v])
        break
      case 'STA':
        write(def.form === 'reg,ind' ? R[r2] : v, R[r])
        break
      case 'MOV':
        setReg(r, R[r2])
        break
      case 'ADD': {
        const sum = R[r] + b
        setReg(r, this.setZC(sum, sum > 0xff))
        break
      }
      case 'SUB': {
        const diff = R[r] - b
        setReg(r, this.setZC(diff, diff < 0))
        break
      }
      case 'CMP': {
        const diff = R[r] - b
        this.setZC(diff, diff < 0)
        break
      }
      case 'AND':
        setReg(r, this.setZC(R[r] & b, false))
        break
      case 'OR':
        setReg(r, this.setZC(R[r] | b, false))
        break
      case 'XOR':
        setReg(r, this.setZC(R[r] ^ b, false))
        break
      case 'SHL':
        setReg(r, this.setZC(R[r] << 1, (R[r] & 0x80) !== 0))
        break
      case 'SHR':
        setReg(r, this.setZC(R[r] >> 1, (R[r] & 1) !== 0))
        break
      case 'JMP':
        jump(v)
        break
      case 'JZ':
        if (this.z) jump(v)
        break
      case 'JNZ':
        if (!this.z) jump(v)
        break
      case 'JC':
        if (this.c) jump(v)
        break
      case 'CALL':
        push(this.pc)
        jump(v)
        break
      case 'RET':
        jump(pop())
        break
      case 'PUSH':
        push(R[r])
        break
      case 'POP':
        setReg(r, pop())
        break
      case 'OUT':
        res.out = R[r]
        this.output.push(R[r])
        break
      case 'HLT':
        this.halted = true
        cost = 0
        break
    }

    res.flagsChanged = this.z !== z0 || this.c !== c0
    res.cycles = cost
    this.cycles += cost
    return res
  }
}

export interface RunResult {
  regs: { A: number; B: number; C: number; D: number }
  flags: { Z: boolean; C: boolean }
  pc: number
  sp: number
  cycles: number
  /** Instructions executed. */
  steps: number
  halted: boolean
  fault: string | null
  output: number[]
  mem: Uint8Array
}

/** Assemble and run a program until HLT, a fault, or `maxSteps`. */
export function runProgram(source: string, maxSteps = 100_000): RunResult {
  const cpu = new CPU()
  cpu.load(assemble(source).bytes)
  let steps = 0
  while (!cpu.halted && steps < maxSteps) {
    cpu.step()
    steps++
  }
  const [A, B, C, D] = cpu.regs
  return {
    regs: { A, B, C, D },
    flags: { Z: cpu.z, C: cpu.c },
    pc: cpu.pc,
    sp: cpu.sp,
    cycles: cpu.cycles,
    steps,
    halted: cpu.halted,
    fault: cpu.fault,
    output: [...cpu.output],
    mem: cpu.mem.slice(),
  }
}
