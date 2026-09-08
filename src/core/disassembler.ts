/** Bytes -> text, driven by the same opcode table the assembler encodes from. */
import { OP_BY_CODE, REGISTERS, hex2 } from './isa'

export interface DisassembledLine {
  address: number
  bytes: number[]
  text: string
}

/** Decode the single instruction starting at `address`. Unknown bytes become `.byte`. */
export function disassembleAt(mem: Uint8Array, address: number): DisassembledLine {
  const at = (i: number) => mem[(address + i) & 0xff]
  const def = OP_BY_CODE[at(0)]
  if (!def) return { address, bytes: [at(0)], text: `.byte 0x${hex2(at(0))}` }
  const bytes = Array.from({ length: def.size }, (_, i) => at(i))
  const reg = (i: number) => REGISTERS[bytes[i] & 3]
  const hx = (i: number) => `0x${hex2(bytes[i])}`
  let operands = ''
  switch (def.form) {
    case 'none':
      break
    case 'reg':
      operands = reg(1)
      break
    case 'addr':
      operands = hx(1)
      break
    case 'reg,reg':
      operands = `${reg(1)}, ${reg(2)}`
      break
    case 'reg,ind':
      operands = `${reg(1)}, [${reg(2)}]`
      break
    case 'reg,imm':
      operands = `${reg(1)}, ${bytes[2]}`
      break
    case 'reg,mem':
      operands = `${reg(1)}, [${hx(2)}]`
      break
  }
  return { address, bytes, text: operands ? `${def.mnemonic} ${operands}` : def.mnemonic }
}

/** Disassemble a range, one instruction at a time. */
export function disassemble(mem: Uint8Array, start = 0, end = mem.length): DisassembledLine[] {
  const lines: DisassembledLine[] = []
  let addr = start
  while (addr < end) {
    const line = disassembleAt(mem, addr)
    lines.push(line)
    addr += line.bytes.length
  }
  return lines
}
