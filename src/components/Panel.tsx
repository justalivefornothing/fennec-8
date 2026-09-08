import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  /** Right-aligned header content (toggles, hints). */
  aside?: ReactNode
  children: ReactNode
  className?: string
  /** Remove the inner padding so the body can bleed to the edges. */
  flush?: boolean
}

export function Panel({ title, aside, children, className = '', flush = false }: PanelProps) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-md border border-sand-deep/70 bg-sand text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_0_rgba(0,0,0,0.35)] ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-sand-deep/60 px-3 py-1.5">
        <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">{title}</h2>
        {aside && <div className="flex min-w-0 items-center gap-2 text-[11px] text-ink-soft">{aside}</div>}
      </header>
      <div className={`min-h-0 flex-1 ${flush ? '' : 'p-3'}`}>{children}</div>
    </section>
  )
}

/** A dark inset "screen" bezel used for readouts. */
export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-sm border border-umber-deep bg-umber-deep shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] ${className}`}
    >
      {children}
    </div>
  )
}
