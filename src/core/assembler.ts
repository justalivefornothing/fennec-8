/**
 * Two-pass assembler for Fennec-8.
 *
 * Pass one tokenizes every line, measures each instruction from its operand
 * shape (1-3 bytes) and records label addresses. Pass two encodes opcodes and
 * operand bytes into a Uint8Array, substituting label addresses.
 */
import { FORM_SIZE, MEM_SIZE, OPS_BY_MNEMONIC, registerIndex, type OpDef, type OperandForm } from './isa'

export class AssembleError extends Error {
  readonly line: number
  constructor(message: string, line: number) {
    super(`${message} on line ${line}`)
    this.name = 'AssembleError'
    this.line = line
  }
}

export interface ListingLine {
  /** 1-based source line. */
  line: number
  /** Address of the first byte, or null for lines that emit nothing. */
  address: number | null
  bytes: number[]
  source: string
}

export interface Assembled {
  bytes: Uint8Array
  listing: ListingLine[]
  labels: Record<string, number>
  /** address -> 1-based source line of the instruction that starts there. */
  lineAt: (number | undefined)[]
}

// ─── tokenizer ────────────────────────────────────────────────────────────────

type Operand =
  | { kind: 'reg'; reg: number }
  | { kind: 'ind'; reg: number }
  | { kind: 'val'; text: string }
  | { kind: 'mem'; text: string }
  | { kind: 'str'; text: string }

interface Statement {
  line: number
  label: string | null
  /** Upper-cased mnemonic or directive (".BYTE"), or null for label-only lines. */
  mnemonic: string | null
  operands: Operand[]
  source: string
}

const LABEL_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Strip a `;` comment, ignoring semicolons inside quotes. */
function stripComment(text: string): string {
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === ';') {
      return text.slice(0, i)
    }
  }
  return text
}

/** Split on commas that are outside quotes and brackets. */
function splitOperands(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let cur = ''
  for (const ch of text) {
    if (quote) {
      cur += ch
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
      cur += ch
    } else if (ch === '[') {
      depth++
      cur += ch
    } else if (ch === ']') {
      depth--
      cur += ch
    } else if (ch === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim() || parts.length) parts.push(cur.trim())
  return parts
}

function parseOperand(raw: string, line: number): Operand {
  if (!raw) throw new AssembleError('Empty operand', line)
  if (raw.startsWith('"')) {
    if (!raw.endsWith('"') || raw.length < 2) throw new AssembleError('Unterminated string', line)
    return { kind: 'str', text: raw.slice(1, -1) }
  }
  if (raw.startsWith('[')) {
    if (!raw.endsWith(']')) throw new AssembleError(`Missing "]" in ${raw}`, line)
    const inner = raw.slice(1, -1).trim()
    const reg = registerIndex(inner)
    if (reg >= 0) return { kind: 'ind', reg }
    if (!inner) throw new AssembleError('Empty brackets', line)
    return { kind: 'mem', text: inner }
  }
  const reg = registerIndex(raw)
  if (reg >= 0) return { kind: 'reg', reg }
  return { kind: 'val', text: raw }
}

export function tokenize(source: string): Statement[] {
  const statements: Statement[] = []
  const lines = source.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = i + 1
    const source = lines[i]
    let rest = stripComment(source).trim()
    let label: string | null = null
    const m = LABEL_RE.exec(rest)
    if (m) {
      label = m[1]
      rest = rest.slice(m[0].length).trim()
    }
    let mnemonic: string | null = null
    let operands: Operand[] = []
    if (rest) {
      const sp = rest.search(/\s/)
      const head = sp < 0 ? rest : rest.slice(0, sp)
      const tail = sp < 0 ? '' : rest.slice(sp).trim()
      mnemonic = head.toUpperCase()
      operands = splitOperands(tail).map((t) => parseOperand(t, line))
    }
    statements.push({ line, label, mnemonic, operands, source })
  }
  return statements
}

// ─── values ───────────────────────────────────────────────────────────────────

/** Parse a numeric literal: 42, -1, 0x2A, $2A, 0b101, %101, 'A'. Returns null if not numeric. */
export function parseNumber(text: string): number | null {
  const t = text.trim()
  let m: RegExpExecArray | null
  if ((m = /^'(.)'$/.exec(t))) return m[1].charCodeAt(0)
  if ((m = /^(-?)(?:0x|\$)([0-9a-fA-F]+)$/.exec(t))) return (m[1] ? -1 : 1) * parseInt(m[2], 16)
  if ((m = /^(-?)(?:0b|%)([01]+)$/.exec(t))) return (m[1] ? -1 : 1) * parseInt(m[2], 2)
  if ((m = /^-?[0-9]+$/.exec(t))) return parseInt(t, 10)
  return null
}

function resolveValue(text: string, labels: Map<string, number>, line: number): number {
  const n = parseNumber(text)
  if (n !== null) return n
  if (IDENT_RE.test(text)) {
    const addr = labels.get(text)
    if (addr === undefined) throw new AssembleError(`Undefined label "${text}"`, line)
    return addr
  }
  throw new AssembleError(`Bad value "${text}"`, line)
}

function toByte(value: number, what: string, line: number): number {
  if (value < -128 || value > 255) throw new AssembleError(`${what} ${value} out of range (-128..255)`, line)
  return value & 0xff
}

// ─── instruction selection ────────────────────────────────────────────────────

function formOf(ops: Operand[]): string {
  return ops.map((o) => o.kind).join(',')
}

/** Pick the opcode definition matching the operand shape, or throw. */
function selectOp(mnemonic: string, operands: Operand[], line: number): OpDef {
  const candidates = OPS_BY_MNEMONIC.get(mnemonic)
  if (!candidates) throw new AssembleError(`Unknown mnemonic "${mnemonic}"`, line)
  const shape = formOf(operands)
  const accepts: Record<OperandForm, string[]> = {
    none: [''],
    reg: ['reg'],
    addr: ['val'],
    'reg,reg': ['reg,reg'],
    'reg,imm': ['reg,val'],
    'reg,mem': ['reg,mem', 'reg,val'],
    'reg,ind': ['reg,ind'],
  }
  // Exact matches first ("reg,val" prefers reg,imm over reg,mem).
  for (const def of candidates) if (accepts[def.form][0] === shape) return def
  for (const def of candidates) if (accepts[def.form].includes(shape)) return def
  const usage = candidates.map((c) => c.usage).join(' | ')
  throw new AssembleError(`Bad operands for ${mnemonic} (expected ${usage})`, line)
}

function directiveSize(mnemonic: string, operands: Operand[], line: number): number {
  if (mnemonic === '.BYTE') {
    if (!operands.length) throw new AssembleError('.byte needs at least one value', line)
    return operands.reduce((n, o) => n + (o.kind === 'str' ? o.text.length : 1), 0)
  }
  if (mnemonic === '.WORD') {
    if (!operands.length) throw new AssembleError('.word needs at least one value', line)
    return operands.length * 2
  }
  throw new AssembleError(`Unknown directive "${mnemonic}"`, line)
}

function encodeDirective(
  mnemonic: string,
  operands: Operand[],
  labels: Map<string, number>,
  line: number,
): number[] {
  const out: number[] = []
  for (const o of operands) {
    if (o.kind === 'str') {
      if (mnemonic === '.WORD') throw new AssembleError('.word does not accept strings', line)
      for (const ch of o.text) out.push(ch.charCodeAt(0) & 0xff)
      continue
    }
    if (o.kind !== 'val') throw new AssembleError(`${mnemonic.toLowerCase()} values must be numbers or labels`, line)
    const v = resolveValue(o.text, labels, line)
    if (mnemonic === '.BYTE') out.push(toByte(v, 'Byte', line))
    else {
      if (v < -32768 || v > 65535) throw new AssembleError(`Word ${v} out of range`, line)
      out.push(v & 0xff, (v >> 8) & 0xff)
    }
  }
  return out
}

function encodeInstruction(def: OpDef, operands: Operand[], labels: Map<string, number>, line: number): number[] {
  const bytes = [def.opcode]
  const val = (o: Operand, what: string) => {
    const text = o.kind === 'val' || o.kind === 'mem' ? o.text : ''
    return toByte(resolveValue(text, labels, line), what, line)
  }
  const reg = (o: Operand) => (o.kind === 'reg' || o.kind === 'ind' ? o.reg : 0)
  switch (def.form) {
    case 'none':
      break
    case 'reg':
      bytes.push(reg(operands[0]))
      break
    case 'addr':
      bytes.push(val(operands[0], 'Address'))
      break
    case 'reg,reg':
    case 'reg,ind':
      bytes.push(reg(operands[0]), reg(operands[1]))
      break
    case 'reg,imm':
      bytes.push(reg(operands[0]), val(operands[1], 'Immediate'))
      break
    case 'reg,mem':
      bytes.push(reg(operands[0]), val(operands[1], 'Address'))
      break
  }
  return bytes
}

// ─── passes ───────────────────────────────────────────────────────────────────

export function assemble(source: string): Assembled {
  const statements = tokenize(source)
  const labels = new Map<string, number>()

  // Pass one: sizes and label addresses.
  let pc = 0
  const sized: { stmt: Statement; address: number; size: number; def: OpDef | null }[] = []
  for (const stmt of statements) {
    if (stmt.label) {
      if (labels.has(stmt.label)) throw new AssembleError(`Duplicate label "${stmt.label}"`, stmt.line)
      if (registerIndex(stmt.label) >= 0) throw new AssembleError(`Label "${stmt.label}" is a register name`, stmt.line)
      labels.set(stmt.label, pc)
    }
    let size = 0
    let def: OpDef | null = null
    if (stmt.mnemonic) {
      if (stmt.mnemonic.startsWith('.')) size = directiveSize(stmt.mnemonic, stmt.operands, stmt.line)
      else {
        def = selectOp(stmt.mnemonic, stmt.operands, stmt.line)
        size = FORM_SIZE[def.form]
      }
    }
    sized.push({ stmt, address: pc, size, def })
    pc += size
    if (pc > MEM_SIZE) throw new AssembleError(`Program exceeds ${MEM_SIZE} bytes`, stmt.line)
  }

  // Pass two: encode.
  const bytes = new Uint8Array(pc)
  const listing: ListingLine[] = []
  const lineAt: (number | undefined)[] = new Array<number | undefined>(MEM_SIZE).fill(undefined)
  for (const { stmt, address, size, def } of sized) {
    let encoded: number[] = []
    if (def) encoded = encodeInstruction(def, stmt.operands, labels, stmt.line)
    else if (stmt.mnemonic) encoded = encodeDirective(stmt.mnemonic, stmt.operands, labels, stmt.line)
    bytes.set(encoded, address)
    if (size > 0) lineAt[address] = stmt.line
    const shown = size > 0 || stmt.label !== null
    listing.push({ line: stmt.line, address: shown ? address : null, bytes: encoded, source: stmt.source })
  }

  return { bytes, listing, labels: Object.fromEntries(labels), lineAt }
}
