import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
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

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/organigramme" element={<Organigramme />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/membres" element={<Membres />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/cotisations" element={<Cotisations />} />
        <Route path="/calendrier" element={<Calendrier />} />
        <Route path="/calendrier/:id" element={<Evenement />} />
        <Route path="/mon-compte" element={<MonCompte />} />
      </Routes>
    </AuthProvider>
  )
}

export default App