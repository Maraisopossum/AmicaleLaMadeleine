import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import RequireAuth from './components/RequireAuth'

const Welcome = lazy(() => import('./pages/public/Welcome'))
const Login = lazy(() => import('./pages/auth/Login'))
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))
const Organigramme = lazy(() => import('./pages/public/Organigramme'))
const Membres = lazy(() => import('./pages/members/Membres'))
const Documents = lazy(() => import('./pages/documents/Documents'))
const Cotisations = lazy(() => import('./pages/cotisations/Cotisations'))
const Calendrier = lazy(() => import('./pages/calendrier/Calendrier'))
const MonCompte = lazy(() => import('./pages/compte/MonCompte'))
const Evenement = lazy(() => import('./pages/calendrier/Evenement'))
const Votes = lazy(() => import('./pages/votes/Votes'))
const VotePage = lazy(() => import('./pages/votes/Vote'))
const Idees = lazy(() => import('./pages/idees/Idees'))
const Taches = lazy(() => import('./pages/taches/Taches'))
const Reunions = lazy(() => import('./pages/reunions/Reunions'))
const ReunionDetail = lazy(() => import('./pages/reunions/ReunionDetail'))
const Recrutement = lazy(() => import('./pages/public/Recrutement'))
const Candidatures = lazy(() => import('./pages/candidatures/Candidatures'))

function Chargement() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-brand-parchment">
      <p className="eyebrow">Chargement…</p>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Chargement />}>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/organigramme" element={<Organigramme />} />
          <Route path="/recrutement" element={<Recrutement />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/membres" element={<RequireAuth><Membres /></RequireAuth>} />
          <Route path="/documents" element={<RequireAuth><Documents /></RequireAuth>} />
          <Route path="/cotisations" element={<RequireAuth><Cotisations /></RequireAuth>} />
          <Route path="/calendrier" element={<RequireAuth><Calendrier /></RequireAuth>} />
          <Route path="/calendrier/:id" element={<RequireAuth><Evenement /></RequireAuth>} />
          <Route path="/mon-compte" element={<RequireAuth><MonCompte /></RequireAuth>} />
          <Route path="/votes" element={<RequireAuth><Votes /></RequireAuth>} />
          <Route path="/votes/:id" element={<RequireAuth><VotePage /></RequireAuth>} />
          <Route path="/idees" element={<RequireAuth><Idees /></RequireAuth>} />
          <Route path="/taches" element={<RequireAuth><Taches /></RequireAuth>} />
          <Route path="/reunions" element={<RequireAuth><Reunions /></RequireAuth>} />
          <Route path="/reunions/:id" element={<RequireAuth><ReunionDetail /></RequireAuth>} />
          <Route path="/candidatures" element={<RequireAuth><Candidatures /></RequireAuth>} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

export default App
