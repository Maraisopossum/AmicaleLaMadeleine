import { Link } from 'react-router-dom'
import { IconFacebook, IconInstagram } from '../../components/IconesSociaux'

const FACEBOOK_URL = import.meta.env.VITE_FACEBOOK_URL as string | undefined
const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL as string | undefined

export default function Welcome() {
  return (
    <div className="min-h-screen bg-brand-ink grain-overlay relative overflow-hidden flex items-center justify-center py-xxl px-md">
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none select-none flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="font-display font-extrabold text-[40vw] leading-none text-brand-sky">
          1847
        </span>
      </div>

      <div className="relative w-full max-w-4xl grid md:grid-cols-2 gap-xl items-stretch">
        {/* Espace membres */}
        <div className="text-center md:text-left flex flex-col items-center md:items-start justify-center">
          <img src="/Logo.png" alt="Amicale des Sapeurs-Pompiers de La Madeleine" className="h-28 w-auto mb-lg drop-shadow-lg" />
          <h1 className="font-display font-extrabold uppercase text-brand-parchment text-3xl md:text-4xl leading-[0.95] mb-xl">
            Amicale des
            <br />
            Sapeurs-Pompiers
            <br />
            de La Madeleine
          </h1>

          <Link to="/login" className="btn-primary">
            Connexion
          </Link>
        </div>

        {/* Vitrine publique */}
        <div className="border border-brand-parchment/20 p-xl flex flex-col justify-center gap-lg">
          <div>
            <p className="text-brand-sky uppercase text-xs tracking-[0.2em] font-semibold mb-xs">Suivez-nous</p>
            <p className="text-sm text-brand-parchment/70 mb-md">
              Actualités, interventions et vie de la caserne sur nos réseaux sociaux.
            </p>
            <div className="flex gap-sm items-center">
              {FACEBOOK_URL && (
                <a
                  href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                  className="w-11 h-11 transition-transform hover:scale-105"
                >
                  <IconFacebook className="w-full h-full" />
                </a>
              )}
              {INSTAGRAM_URL && (
                <a
                  href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                  className="w-11 h-11 transition-transform hover:scale-105"
                >
                  <IconInstagram className="w-full h-full" />
                </a>
              )}
            </div>
          </div>

          <div className="border-t border-brand-parchment/20 pt-lg">
            <p className="text-brand-sky uppercase text-xs tracking-[0.2em] font-semibold mb-xs">Envie de nous rejoindre ?</p>
            <p className="text-sm text-brand-parchment/70 mb-md">
              Découvre en 1 minute si tu peux devenir sapeur-pompier volontaire.
            </p>
            <Link to="/recrutement" className="btn-primary text-sm inline-block">
              Je tente le test →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
