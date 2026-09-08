import { memo } from 'react'
import { OPS, hex2 } from '../core/isa'
import { Panel } from './Panel'

/** Quick reference rendered straight from the opcode table. */
export const IsaReference = memo(function IsaReference() {
  return (
    <Panel
      title="Instruction set"
      flush
      aside={<span className="font-mono">{OPS.length} opcodes · r = A B C D · [x] = memory</span>}
    >
      <div className="max-h-[240px] overflow-auto">
        <table className="w-full border-collapse font-mono text-[11px] leading-5">
          <thead className="sticky top-0 bg-sand text-left font-display text-[10px] uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-3 py-1 font-bold">Op</th>
              <th className="px-2 py-1 font-bold">Syntax</th>
              <th className="px-2 py-1 font-bold">B</th>
              <th className="px-2 py-1 pr-3 font-bold">Effect</th>
            </tr>
          </thead>
          <tbody>
            {OPS.map((op) => (
              <tr key={op.opcode} className="border-t border-sand-deep/40 hover:bg-sand-dark/60">
                <td className="px-3 text-ember">{hex2(op.opcode)}</td>
                <td className="px-2 whitespace-nowrap text-ink">{op.usage}</td>
                <td className="px-2 text-ink-soft">{op.size}</td>
                <td className="px-2 pr-3 text-ink-soft">{op.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-sand-deep/40 px-3 py-1.5 text-[10px] text-ink-soft">
        Literals: 42, 0x2A, $2A, 0b101010, %101010, 'A', -1 · directives: .byte, .word · labels: name: · comments: ;
      </p>
    </Panel>
  )
})
