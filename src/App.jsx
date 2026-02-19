import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Simulateur from './pages/Simulateur'
import Biens from './pages/Biens'
import Financement from './pages/Financement'
import Fiscalite from './pages/Fiscalite'
import Questionnaire from './pages/Questionnaire'
import Equipe from './pages/Equipe'
import Login from './pages/Login'
import GroupSetup from './pages/GroupSetup'

function AppRoutes() {
  const { user } = useAuth()

  if (!user) return <Login />
  if (!user.group_id) return <GroupSetup />

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="simulateur" element={<Simulateur />} />
        <Route path="biens" element={<Biens />} />
        <Route path="financement" element={<Financement />} />
        <Route path="fiscalite" element={<Fiscalite />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="equipe" element={<Equipe />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
