import { Link } from 'react-router-dom'

export default function Welcome() {
  return (
    <div className="min-h-screen bg-brand-ink grain-overlay flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none select-none flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="font-display font-extrabold text-[40vw] leading-none text-brand-sky">
          1847
        </span>
      </div>

      <div className="relative text-center px-xl">
        <p className="eyebrow text-brand-sky mb-md">Caserne fondée en 1847</p>
        <img src="/Logo.png" alt="Amicale des Sapeurs-Pompiers de La Madeleine" className="h-32 w-auto mx-auto mb-lg drop-shadow-lg" />
        <h1 className="font-display font-extrabold uppercase text-brand-parchment text-4xl md:text-5xl leading-[0.95] mb-xs">
          Amicale des
          <br />
          Sapeurs-Pompiers
        </h1>
        <p className="text-brand-parchment/60 uppercase text-sm tracking-[0.2em] mb-xl">de La Madeleine</p>

        <div className="flex flex-col gap-sm items-center">
          <Link to="/login" className="btn-primary">
            Connexion
          </Link>
          <Link to="/organigramme" className="text-brand-sky hover:text-brand-parchment text-sm uppercase tracking-[0.12em] font-semibold mt-sm">
            Voir l'organigramme
          </Link>
        </div>
      </div>
    </div>
  )
}
