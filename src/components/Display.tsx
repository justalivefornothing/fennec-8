import { DISPLAY_BASE, DISPLAY_H, DISPLAY_W, hex2 } from '../core/isa'
import { Panel, Screen } from './Panel'

/** 16x16 one-bit display mapped at 0xE0-0xFF: two bytes per row, MSB is the left pixel. */
export function Display({ mem }: { mem: Uint8Array }) {
  const pixels: boolean[] = []
  for (let y = 0; y < DISPLAY_H; y++) {
    for (let x = 0; x < DISPLAY_W; x++) {
      const byte = mem[DISPLAY_BASE + y * 2 + (x >> 3)]
      pixels.push((byte & (0x80 >> (x & 7))) !== 0)
    }
  }
  const lit = pixels.filter(Boolean).length
  return (
    <Panel
      title="Display"
      className="flex-1 justify-center"
      aside={
        <span className="font-mono">
          {hex2(DISPLAY_BASE)}-{hex2(DISPLAY_BASE + 31)} · {lit} lit
        </span>
      }
    >
      <Screen className="mx-auto w-full max-w-[280px] p-2">
        <div
          className="grid aspect-square w-full gap-px"
          style={{ gridTemplateColumns: `repeat(${DISPLAY_W}, minmax(0, 1fr))` }}
          role="img"
          aria-label={`16 by 16 display, ${lit} pixels lit`}
        >
          {pixels.map((on, i) => (
            <div
              key={i}
              className={`rounded-[1px] ${
                on ? 'bg-ember-bright shadow-[0_0_6px_1px_rgba(255,138,61,0.55)]' : 'bg-umber-light/40'
              }`}
            />
          ))}
        </div>
      </Screen>
    </Panel>
  )
}
