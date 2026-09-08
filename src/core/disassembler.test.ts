import { describe, expect, it } from 'vitest'
import { assemble } from './assembler'
import { disassemble, disassembleAt } from './disassembler'
import { OPS } from './isa'

describe('disassemble', () => {
  it('round-trips every instruction form through the shared opcode table', () => {
    const src = [
      'NOP',
      'LDI A, 5',
      'LDA B, [0x10]',
      'STA C, [0x11]',
      'LDA D, [A]',
      'STA A, [B]',
      'MOV C, D',
      'ADD A, B',
      'SUB A, 3',
      'SHL A',
      'CMP A, 0',
      'JMP 0x00',
      'CALL 0x02',
      'RET',
      'PUSH D',
      'POP D',
      'OUT A',
      'HLT',
    ]
    const asm = assemble(src.join('\n'))
    const text = disassemble(asm.bytes).map((l) => l.text)
    expect(text).toEqual(src)
    // Re-assembling the disassembly reproduces the bytes.
    expect(assemble(text.join('\n')).bytes).toEqual(asm.bytes)
  })

  it('renders unknown bytes as .byte', () => {
    expect(disassembleAt(new Uint8Array([0x99]), 0).text).toBe('.byte 0x99')
  })

  it('has unique opcodes in the table', () => {
    const codes = OPS.map((o) => o.opcode)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
