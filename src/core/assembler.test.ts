import { describe, expect, it } from 'vitest'
import { assemble, parseNumber } from './assembler'

describe('assemble', () => {
  it('encodes LDI and HLT exactly', () => {
    expect(assemble('LDI A, 5\nHLT').bytes).toEqual(new Uint8Array([0x01, 0x00, 0x05, 0xff]))
  })

  it('throws on undefined labels with the line number', () => {
    expect(() => assemble('JMP nowhere')).toThrow(/Undefined label "nowhere" on line 1/)
    expect(() => assemble('HLT\n\nJZ later')).toThrow(/Undefined label "later" on line 3/)
  })

  it('throws on duplicate labels', () => {
    expect(() => assemble('x: NOP\nx: NOP')).toThrow(/Duplicate label "x" on line 2/)
  })

  it('throws on unknown mnemonics and bad operands', () => {
    expect(() => assemble('FOO A')).toThrow(/Unknown mnemonic "FOO" on line 1/)
    expect(() => assemble('LDI 5, A')).toThrow(/Bad operands for LDI/)
    expect(() => assemble('LDI A, 300')).toThrow(/out of range/)
  })

  it('resolves forward and backward labels in two passes', () => {
    const { bytes, labels } = assemble(['JMP end', 'mid: NOP', 'end: JMP mid'].join('\n'))
    expect(labels).toEqual({ mid: 2, end: 3 })
    expect(Array.from(bytes)).toEqual([0x20, 0x03, 0x00, 0x20, 0x02])
  })

  it('accepts decimal, hex, binary, char and negative literals', () => {
    const { bytes } = assemble('LDI A, 0x2A\nLDI B, $2a\nLDI C, 0b1010\nLDI D, %11\nLDI A, -1\nLDI B, \'Z\'')
    const imms = [2, 5, 8, 11, 14, 17].map((i) => bytes[i])
    expect(imms).toEqual([42, 42, 10, 3, 255, 90])
  })

  it('handles comments, blank lines and label-only lines', () => {
    const src = '; header\n\nstart:\n  LDI A, 1 ; trailing\n  OUT A\n  HLT'
    const asm = assemble(src)
    expect(Array.from(asm.bytes)).toEqual([0x01, 0x00, 0x01, 0x40, 0x00, 0xff])
    expect(asm.labels.start).toBe(0)
    expect(asm.lineAt[0]).toBe(4)
    expect(asm.lineAt[3]).toBe(5)
    expect(asm.listing).toHaveLength(6)
    expect(asm.listing[2]).toMatchObject({ line: 3, address: 0, bytes: [] })
  })

  it('emits .byte and .word directives, including strings', () => {
    const asm = assemble('data: .byte 1, 0xFF, "Hi", \'!\'\nw: .word 0x1234, 7')
    expect(Array.from(asm.bytes)).toEqual([1, 255, 72, 105, 33, 0x34, 0x12, 7, 0])
    expect(asm.labels).toEqual({ data: 0, w: 5 })
  })

  it('lets labels stand in for immediates', () => {
    const asm = assemble('LDI B, msg\nHLT\nmsg: .byte "A"')
    expect(Array.from(asm.bytes)).toEqual([0x01, 0x01, 0x04, 0xff, 65])
  })

  it('picks register or immediate forms of ALU ops and both LDA/STA addressing modes', () => {
    const asm = assemble('ADD A, B\nADD A, 1\nLDA C, [0x10]\nSTA C, [D]\nSTA C, 0x11')
    expect(Array.from(asm.bytes)).toEqual([
      0x10, 0, 1, //  ADD A, B
      0x11, 0, 1, //  ADD A, 1
      0x02, 2, 0x10, // LDA C, [0x10]
      0x05, 2, 3, //  STA C, [D]
      0x03, 2, 0x11, // STA C, 0x11 (bare address accepted)
    ])
  })

  it('is case-insensitive for mnemonics and registers', () => {
    expect(Array.from(assemble('ldi a, 5\nhlt').bytes)).toEqual([1, 0, 5, 0xff])
  })

  it('rejects programs larger than memory', () => {
    const big = Array.from({ length: 90 }, () => 'LDI A, 1').join('\n')
    expect(() => assemble(big)).toThrow(/exceeds 256 bytes on line 86/)
  })
})

describe('parseNumber', () => {
  it('parses supported literal syntaxes', () => {
    expect(parseNumber('42')).toBe(42)
    expect(parseNumber('0xFF')).toBe(255)
    expect(parseNumber('$ff')).toBe(255)
    expect(parseNumber('0b101')).toBe(5)
    expect(parseNumber('%101')).toBe(5)
    expect(parseNumber("'A'")).toBe(65)
    expect(parseNumber('-0x10')).toBe(-16)
    expect(parseNumber('label')).toBeNull()
  })
})
