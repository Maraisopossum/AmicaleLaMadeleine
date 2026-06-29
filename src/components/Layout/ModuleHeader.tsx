import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type ModuleHeaderProps = {
  eyebrowCode: string
  eyebrowLabel: string
  title: ReactNode
  subtitle?: string
  rightSlot?: ReactNode
}

export default function ModuleHeader({ eyebrowCode, eyebrowLabel, title, subtitle, rightSlot }: ModuleHeaderProps) {
  return (
    <header className="relative overflow-hidden bg-brand-ink grain-overlay">
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none select-none flex items-center justify-end"
        aria-hidden="true"
      >
        <span className="font-display font-extrabold text-[22vw] leading-none text-brand-sky -mr-8 -mb-10">
          1847
        </span>
      </div>

      <nav className="relative max-w-6xl mx-auto px-xl pt-lg flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-sm">
          <img src="/Logo.png" alt="" className="h-12 w-auto drop-shadow-lg" />
          <span className="font-display font-bold uppercase tracking-[0.08em] text-brand-parchment text-sm leading-tight">
            Amicale<br />La Madeleine
          </span>
        </Link>
        {rightSlot ?? (
          <Link
            to="/dashboard"
            className="border border-brand-sky/60 text-brand-parchment uppercase text-xs tracking-[0.15em] font-semibold px-md py-xs hover:bg-brand-sky hover:text-brand-ink transition-colors"
          >
            ← Menu
          </Link>
        )}
      </nav>

      <div className="relative max-w-6xl mx-auto px-xl pt-xl pb-xxl">
        <p className="text-brand-sky uppercase text-xs md:text-sm tracking-[0.3em] font-semibold mb-sm">
          {eyebrowCode} — {eyebrowLabel}
        </p>
        <h1 className="font-display font-extrabold uppercase text-brand-parchment leading-[0.95] text-4xl md:text-6xl max-w-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-md text-brand-parchment/70 max-w-lg text-sm md:text-base">{subtitle}</p>
        )}
      </div>

      <div
        className="h-10 md:h-16 bg-brand-parchment"
        style={{ clipPath: 'polygon(0 100%, 100% 0, 100% 100%)' }}
      />
    </header>
  )
}
