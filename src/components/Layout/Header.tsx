import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Header() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="bg-brand-ink border-b-2 border-brand-petrol">
      <nav className="max-w-6xl mx-auto px-xl h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-sm" onClick={() => setOpen(false)}>
          <img src="/Logo.png" alt="" className="h-9 w-auto" />
          <span className="font-display font-bold uppercase tracking-[0.08em] text-brand-parchment text-sm leading-tight">
            Amicale<br />La Madeleine
          </span>
        </Link>

        {/* Navigation desktop */}
        <div className="hidden md:flex items-center gap-lg">
          <Link to="/organigramme" className="text-brand-parchment/70 hover:text-brand-sky uppercase text-xs tracking-[0.12em] font-semibold">
            Organigramme
          </Link>
          {user ? (
            <Link to="/dashboard" className="text-brand-parchment/70 hover:text-brand-sky uppercase text-xs tracking-[0.12em] font-semibold">
              Menu
            </Link>
          ) : (
            <Link to="/login" className="btn-primary text-xs">
              Connexion
            </Link>
          )}
        </div>

        {/* Bouton hamburger mobile */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px]"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          onClick={() => setOpen(o => !o)}
        >
          <span className={`block w-5 h-0.5 bg-brand-parchment transition-transform origin-center ${open ? 'translate-y-[7px] rotate-45' : ''}`} />
          <span className={`block w-5 h-0.5 bg-brand-parchment transition-opacity ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-brand-parchment transition-transform origin-center ${open ? '-translate-y-[7px] -rotate-45' : ''}`} />
        </button>
      </nav>

      {/* Menu déroulant mobile */}
      {open && (
        <div className="md:hidden border-t border-brand-petrol bg-brand-ink">
          <div className="flex flex-col px-xl py-md gap-md">
            <Link
              to="/organigramme"
              className="text-brand-parchment/70 hover:text-brand-sky uppercase text-xs tracking-[0.12em] font-semibold py-xs"
              onClick={() => setOpen(false)}
            >
              Organigramme
            </Link>
            {user ? (
              <Link
                to="/dashboard"
                className="text-brand-parchment/70 hover:text-brand-sky uppercase text-xs tracking-[0.12em] font-semibold py-xs"
                onClick={() => setOpen(false)}
              >
                Menu
              </Link>
            ) : (
              <Link to="/login" className="btn-primary text-xs self-start" onClick={() => setOpen(false)}>
                Connexion
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
