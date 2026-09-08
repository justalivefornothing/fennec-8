export interface Example {
  id: string
  name: string
  blurb: string
  source: string
}

export const EXAMPLES: readonly Example[] = [
  {
    id: 'counter',
    name: 'Counter',
    blurb: 'Counts 0-9 on the OUT port.',
    source: `; Counter - writes 0..9 to the OUT port
; Registers: A = counter

        LDI A, 0
loop:   OUT A
        ADD A, 1
        CMP A, 10
        JNZ loop
        HLT
`,
  },
  {
    id: 'multiply',
    name: 'Multiply',
    blurb: '6 x 7 by repeated addition.',
    source: `; Multiply - 6 x 7 by repeated addition
; A = multiplicand, B = counter, C = product

        LDI A, 6
        LDI B, 7
        LDI C, 0
loop:   ADD C, A
        SUB B, 1
        JNZ loop
        STA C, [result]     ; keep it in RAM too
        OUT C
        HLT

result: .byte 0
`,
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci',
    blurb: 'Terms until the sum overflows a byte.',
    source: `; Fibonacci - OUT each term until it no longer fits in 8 bits
; A = previous, B = current

        LDI A, 0
        LDI B, 1
loop:   OUT B
        MOV C, B            ; remember current
        ADD B, A            ; current += previous
        JC done             ; carry -> overflowed 255
        MOV A, C
        JMP loop
done:   HLT
`,
  },
  {
    id: 'string',
    name: 'String print',
    blurb: 'Walks a zero-terminated string with [B].',
    source: `; String print - walk a zero-terminated string with a pointer in B
; Labels can be used as immediates, so LDI B, msg loads the address.

        LDI B, msg
loop:   LDA A, [B]          ; A = *B
        CMP A, 0
        JZ done
        OUT A
        ADD B, 1
        JMP loop
done:   HLT

msg:    .byte "HELLO, FENNEC!", 0
`,
  },
  {
    id: 'bounce',
    name: 'Bouncing pixel',
    blurb: 'A dot ricochets around the 16x16 display.',
    source: `; Bouncing pixel - a dot ricochets around the 16x16 display.
; The display is memory 0xE0-0xFF: 2 bytes per row, MSB = leftmost pixel.
; State lives in RAM (x, y, dx, dy); plot() toggles a pixel with XOR.

start:  LDI A, 3
        STA A, [x]
        LDI A, 5
        STA A, [y]
        LDI A, 1
        STA A, [dx]
        STA A, [dy]
        LDA A, [x]
        LDA B, [y]
        CALL plot           ; light the first pixel

loop:   LDA A, [x]          ; --- step x, bounce off the walls ---
        LDA B, [dx]
        ADD A, B
        STA A, [nx]
        CMP A, 0
        JZ flipx
        CMP A, 15
        JNZ stepy
flipx:  LDI C, 0
        SUB C, B            ; dx = -dx
        STA C, [dx]

stepy:  LDA A, [y]          ; --- step y ---
        LDA B, [dy]
        ADD A, B
        STA A, [ny]
        CMP A, 0
        JZ flipy
        CMP A, 15
        JNZ draw
flipy:  LDI C, 0
        SUB C, B
        STA C, [dy]

draw:   LDA A, [nx]         ; light the new pixel...
        LDA B, [ny]
        CALL plot
        LDA A, [x]          ; ...then clear the old one
        LDA B, [y]
        CALL plot
        LDA A, [nx]
        STA A, [x]
        LDA A, [ny]
        STA A, [y]
        JMP loop

; plot - toggle the pixel at (A = x, B = y). Clobbers A B C D.
plot:   SHL B
        ADD B, 0xE0         ; B = address of the row
        MOV C, A
        SHR C
        SHR C
        SHR C               ; C = x / 8 -> left or right byte
        ADD B, C
        AND A, 7
        ADD A, masks        ; A = &masks[x % 8]
        LDA C, [A]          ; C = bit mask
        LDA D, [B]
        XOR D, C
        STA D, [B]
        RET

masks:  .byte 0x80, 0x40, 0x20, 0x10, 8, 4, 2, 1
x:      .byte 0
y:      .byte 0
dx:     .byte 0
dy:     .byte 0
nx:     .byte 0
ny:     .byte 0
`,
  },
]

export const DEFAULT_EXAMPLE_ID = 'bounce'
