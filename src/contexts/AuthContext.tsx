import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, Membre } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  membre: Membre | null
  loading: boolean
  isAdmin: boolean
  canManageMembres: boolean
  accesCandidatures: boolean
  refreshMembre: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  membre: null,
  loading: true,
  isAdmin: false,
  canManageMembres: false,
  accesCandidatures: false,
  refreshMembre: async () => {},
})

// Le compte admin est toujours le même (indépendant de qui est élu président
// au bureau) — il doit rester aligné avec is_membre_manager() côté RLS
// (supabase/migrations/20240111000000_membres_gestionnaire.sql).
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string

// eslint-disable-next-line react-refresh/only-export-components -- useAuth est importé par quasiment toutes les pages ; le déplacer dans un fichier séparé casserait ces imports pour un simple confort de Fast Refresh en dev, pas un bug.
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [membre, setMembre] = useState<Membre | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.email === ADMIN_EMAIL ||
                  membre?.role === 'president' ||
                  membre?.role === 'tresorier' ||
                  membre?.role === 'secretaire' ||
                  membre?.role === 'adjoint_president' ||
                  membre?.role === 'adjoint_secretaire' ||
                  membre?.role === 'adjoint_tresorier'

  const canManageMembres = membre?.role === 'president' || user?.email === ADMIN_EMAIL

  // Périmètre distinct de canManageMembres : accès aux candidatures de
  // recrutement, réservé à l'admin fixe + aux membres explicitement désignés
  // (cf. 20260808000000_candidatures.sql, is_candidature_manager()).
  const accesCandidatures = user?.email === ADMIN_EMAIL || membre?.acces_candidatures === true

  const refreshMembre = async () => {
    if (!user?.email) return
    const { data } = await supabase.from('membres').select('*').eq('email', user.email).single()
    setMembre(data)
  }

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)

      if (session?.user) {
        const { data } = await supabase
          .from('membres')
          .select('*')
          .eq('email', session.user.email)
          .single()
        setMembre(data)
      }

      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)

        if (session?.user) {
          const email = session.user.email
          // Ne pas awaiter de requête Supabase directement dans ce callback :
          // le client auth tient un verrou pendant son exécution, et une requête
          // qui a besoin de ce verrou (rafraîchissement de token) resterait
          // bloquée indéfiniment (deadlock). On défère donc hors du callback.
          setTimeout(async () => {
            const { data } = await supabase
              .from('membres')
              .select('*')
              .eq('email', email)
              .single()
            setMembre(data)
            setLoading(false)
          }, 0)
        } else {
          setMembre(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, membre, loading, isAdmin, canManageMembres, accesCandidatures, refreshMembre }}>
      {children}
    </AuthContext.Provider>
  )
}
