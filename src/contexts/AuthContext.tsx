import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, Membre } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  membre: Membre | null
  loading: boolean
  isAdmin: boolean
  canManageMembres: boolean
  refreshMembre: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  membre: null,
  loading: true,
  isAdmin: false,
  canManageMembres: false,
  refreshMembre: async () => {},
})

// Le compte admin est toujours le même (indépendant de qui est élu président
// au bureau) — il doit rester aligné avec is_membre_manager() côté RLS
// (supabase/migrations/20240111000000_membres_gestionnaire.sql).
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string

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
      async (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, membre, loading, isAdmin, canManageMembres, refreshMembre }}>
      {children}
    </AuthContext.Provider>
  )
}