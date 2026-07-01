import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const ADMIN_SHORTCUT = 'admin'

export default function Login() {
  const [identifiant, setIdentifiant] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const isAdminShortcut = identifiant.trim().toLowerCase() === ADMIN_SHORTCUT && password === ADMIN_SHORTCUT

    const { error } = await supabase.auth.signInWithPassword(
      isAdminShortcut
        ? {
            email: import.meta.env.VITE_ADMIN_EMAIL as string,
            password: import.meta.env.VITE_ADMIN_PASSWORD as string,
          }
        : { email: identifiant, password }
    )

    if (error) {
      setError(error.message)
    } else {
      navigate('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-parchment font-body text-brand-ink">
      <div className="max-w-md w-full mx-auto p-xl">
        <div className="signature-card signature-coral text-center mb-xl">
          <h1 className="text-display-md text-brand-parchment leading-tight">
            Amicale des Sapeurs-Pompiers
            <br />
            de La Madeleine
          </h1>
          <p className="opacity-90 text-sm mt-xs">Espace membres</p>
        </div>

        <form onSubmit={handleLogin} className="signature-card">
          {error && (
            <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm">
              {error}
            </div>
          )}

          <div className="mb-md">
            <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Identifiant</label>
            <input
              type="text"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
              required
            />
          </div>

          <div className="mb-lg">
            <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-sm text-brand-ink/50 mt-lg">
          Les membres sont ajoutés manuellement par le bureau.
        </p>
      </div>
    </div>
  )
}