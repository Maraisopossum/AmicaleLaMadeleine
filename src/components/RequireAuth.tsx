import { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

// Garde d'auth centralisée pour toutes les routes protégées (voir App.tsx).
// Remplace le pattern historique dupliqué dans chaque page (un useEffect qui
// redirige vers /login si !user) — voir CLAUDE.md pour le contexte.
//
// En plus de la vérification de session, force la redirection vers
// /mon-compte tant que membre.doit_changer_mdp est vrai (mot de passe
// temporaire attribué par le bureau non encore changé), sauf sur
// /mon-compte elle-même pour ne pas bloquer le changement de mot de passe.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, membre, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const mustChangePassword = membre?.doit_changer_mdp && location.pathname !== '/mon-compte'

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/login')
    } else if (mustChangePassword) {
      navigate('/mon-compte')
    }
  }, [loading, user, mustChangePassword, navigate])

  if (loading || !user || mustChangePassword) {
    return null
  }

  return <>{children}</>
}
