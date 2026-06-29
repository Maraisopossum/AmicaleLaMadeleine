import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Header() {
  const { user } = useAuth()

  return (
    <header className="bg-brand-ink border-b-2 border-brand-petrol">
      <nav className="max-w-6xl mx-auto px-xl h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-sm">
          <img src="/Logo.png" alt="" className="h-9 w-auto" />
          <span className="font-display font-bold uppercase tracking-[0.08em] text-brand-parchment text-sm leading-tight">
            Amicale<br />La Madeleine
          </span>
        </Link>

        <div className="flex items-center gap-lg">
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
      </nav>
    </header>
  )
}
