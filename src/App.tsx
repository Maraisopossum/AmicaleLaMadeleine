import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import RequireAuth from './components/RequireAuth'
import Welcome from './pages/public/Welcome'
import Login from './pages/auth/Login'
import Dashboard from './pages/dashboard/Dashboard'
import Organigramme from './pages/public/Organigramme'
import Membres from './pages/members/Membres'
import Documents from './pages/documents/Documents'
import Cotisations from './pages/cotisations/Cotisations'
import Calendrier from './pages/calendrier/Calendrier'
import MonCompte from './pages/compte/MonCompte'
import Evenement from './pages/calendrier/Evenement'
import Votes from './pages/votes/Votes'
import VotePage from './pages/votes/Vote'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/organigramme" element={<Organigramme />} />
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
      </Routes>
    </AuthProvider>
  )
}

export default App