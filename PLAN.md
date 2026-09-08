# Fennec-8 — plan

A two-pass assembler and cycle-stepped 8-bit CPU emulator with registers, flags,
a 256-byte memory grid, and a memory-mapped 16x16 pixel display.

## Goal

Assemble the bundled "bouncing pixel" program, hit Run, and watch the memory grid
flicker as bytes change while the 16x16 display shows a dot bouncing off the walls,
all driven by a CPU you can pause and single-step.

## Features

- Assembler: labels, comments, `.byte` / `.word` directives, decimal / hex / binary /
  char literals, two-pass label resolution, undefined / duplicate label errors with
  line numbers.
- ISA (~20 mnemonics): LDI, LDA, STA, MOV, ADD, SUB, AND, OR, XOR, SHL, SHR, CMP,
  JMP, JZ, JNZ, JC, PUSH, POP, CALL, RET, OUT, HLT (+ NOP).
- Emulator: 4 registers (A B C D), PC, SP, Z / C flags, 256 bytes RAM; the upper
  32 bytes (0xE0-0xFF) are a 16x16 1-bit display.
- Controls: assemble, run at selectable Hz, step, reset; current PC highlighted in
  listing and memory.
- Register / flag panel with DEC / HEX / BIN views and a last-changed flash.
- Memory grid with write-highlighting and click-to-edit bytes.
- OUT port appends to a console strip.
- Example programs: counter, multiply, fibonacci, string print, bouncing pixel.

## Architecture

```
src/core/isa.ts           opcode table — single source of truth
src/core/assembler.ts     tokenizer + pass 1 (addresses) + pass 2 (encode)
src/core/disassembler.ts  bytes -> text, driven by the same table
src/core/cpu.ts           fetch / decode / execute, flags, cycle costs, runProgram()
src/core/examples.ts      bundled programs
src/hooks/useEmulator.ts  CPU in a ref, rAF scheduler, snapshots for React
src/components/*          Controls, Editor, Listing, Registers, Display, MemoryGrid, Console
```

Cycle model: every instruction costs 1 cycle; a control transfer that actually
reloads PC (JMP, taken JZ/JNZ/JC, CALL, RET) costs 1 more; HLT stops the clock
and costs nothing.

## Milestones

1. Plan, license, scaffold.
2. Core: isa + assembler + cpu with vitest coverage.
3. UI: controls, editor, listing, registers, display, memory grid, console.
4. Examples, polish, smoke test, README, publish.
