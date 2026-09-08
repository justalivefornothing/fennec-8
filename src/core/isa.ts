/**
 * Fennec-8 instruction set — the single source of truth shared by the
 * assembler, the disassembler and the emulator.
 *
 * Encoding: [opcode] [operand bytes...]. Registers are one byte each
 * (A=0 B=1 C=2 D=3); immediates and addresses are one byte (memory is 256 bytes).
 */

export const MEM_SIZE = 256
export const DISPLAY_BASE = 0xe0
export const DISPLAY_SIZE = 32
export const DISPLAY_W = 16
export const DISPLAY_H = 16
/** Empty-stack SP. PUSH pre-decrements, so the first push lands at 0xDF. */
export const STACK_TOP = DISPLAY_BASE

export const REGISTERS = ['A', 'B', 'C', 'D'] as const
export type RegisterName = (typeof REGISTERS)[number]

/** Operand shapes. `mem` is `[addr]`, `ind` is `[reg]`. */
export type OperandForm = 'none' | 'reg' | 'reg,reg' | 'reg,imm' | 'reg,mem' | 'reg,ind' | 'addr'

export const FORM_SIZE: Record<OperandForm, number> = {
  none: 1,
  reg: 2,
  addr: 2,
  'reg,reg': 3,
  'reg,imm': 3,
  'reg,mem': 3,
  'reg,ind': 3,
}

export interface OpDef {
  mnemonic: string
  opcode: number
  form: OperandForm
  size: number
  /** Human-readable operand template used in error messages and docs. */
  usage: string
  desc: string
}

function op(mnemonic: string, opcode: number, form: OperandForm, usage: string, desc: string): OpDef {
  return { mnemonic, opcode, form, size: FORM_SIZE[form], usage, desc }
}

export const OPS: readonly OpDef[] = [
  op('NOP', 0x00, 'none', 'NOP', 'Do nothing'),
  op('LDI', 0x01, 'reg,imm', 'LDI r, imm', 'Load immediate into r'),
  op('LDA', 0x02, 'reg,mem', 'LDA r, [addr]', 'Load r from memory'),
  op('STA', 0x03, 'reg,mem', 'STA r, [addr]', 'Store r to memory'),
  op('LDA', 0x04, 'reg,ind', 'LDA r, [r2]', 'Load r from the address in r2'),
  op('STA', 0x05, 'reg,ind', 'STA r, [r2]', 'Store r to the address in r2'),
  op('MOV', 0x06, 'reg,reg', 'MOV r, r2', 'Copy r2 into r'),

  op('ADD', 0x10, 'reg,reg', 'ADD r, r2', 'r = r + r2 (Z, C)'),
  op('ADD', 0x11, 'reg,imm', 'ADD r, imm', 'r = r + imm (Z, C)'),
  op('SUB', 0x12, 'reg,reg', 'SUB r, r2', 'r = r - r2 (Z, C=borrow)'),
  op('SUB', 0x13, 'reg,imm', 'SUB r, imm', 'r = r - imm (Z, C=borrow)'),
  op('AND', 0x14, 'reg,reg', 'AND r, r2', 'r = r & r2 (Z)'),
  op('AND', 0x15, 'reg,imm', 'AND r, imm', 'r = r & imm (Z)'),
  op('OR', 0x16, 'reg,reg', 'OR r, r2', 'r = r | r2 (Z)'),
  op('OR', 0x17, 'reg,imm', 'OR r, imm', 'r = r | imm (Z)'),
  op('XOR', 0x18, 'reg,reg', 'XOR r, r2', 'r = r ^ r2 (Z)'),
  op('XOR', 0x19, 'reg,imm', 'XOR r, imm', 'r = r ^ imm (Z)'),
  op('SHL', 0x1a, 'reg', 'SHL r', 'Shift left; C = bit 7 (Z)'),
  op('SHR', 0x1b, 'reg', 'SHR r', 'Shift right; C = bit 0 (Z)'),
  op('CMP', 0x1c, 'reg,reg', 'CMP r, r2', 'Flags of r - r2, r unchanged'),
  op('CMP', 0x1d, 'reg,imm', 'CMP r, imm', 'Flags of r - imm, r unchanged'),

  op('JMP', 0x20, 'addr', 'JMP addr', 'Jump'),
  op('JZ', 0x21, 'addr', 'JZ addr', 'Jump if Z'),
  op('JNZ', 0x22, 'addr', 'JNZ addr', 'Jump if not Z'),
  op('JC', 0x23, 'addr', 'JC addr', 'Jump if C'),
  op('CALL', 0x24, 'addr', 'CALL addr', 'Push return address, jump'),
  op('RET', 0x25, 'none', 'RET', 'Pop return address'),

  op('PUSH', 0x30, 'reg', 'PUSH r', 'Push r onto the stack'),
  op('POP', 0x31, 'reg', 'POP r', 'Pop into r'),
  op('OUT', 0x40, 'reg', 'OUT r', 'Write r to the output port'),
  op('HLT', 0xff, 'none', 'HLT', 'Stop the clock'),
]

/** opcode -> definition (sparse). */
export const OP_BY_CODE: ReadonlyArray<OpDef | undefined> = (() => {
  const table: (OpDef | undefined)[] = new Array<OpDef | undefined>(256).fill(undefined)
  for (const def of OPS) table[def.opcode] = def
  return table
})()

/** MNEMONIC -> all its forms (e.g. ADD has reg,reg and reg,imm). */
export const OPS_BY_MNEMONIC: ReadonlyMap<string, readonly OpDef[]> = (() => {
  const map = new Map<string, OpDef[]>()
  for (const def of OPS) {
    const list = map.get(def.mnemonic) ?? []
    list.push(def)
    map.set(def.mnemonic, list)
  }
  return map
})()

export const MNEMONICS: readonly string[] = [...OPS_BY_MNEMONIC.keys()]

export function registerIndex(name: string): number {
  return REGISTERS.indexOf(name.toUpperCase() as RegisterName)
}

export const hex2 = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0')
export const bin8 = (n: number): string => n.toString(2).padStart(8, '0')
