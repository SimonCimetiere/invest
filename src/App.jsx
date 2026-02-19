import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Biens from './pages/Biens'
import Equipe from './pages/Equipe'
import Patrimoine from './pages/Patrimoine'
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
        <Route path="biens" element={<Biens />} />
        <Route path="patrimoine" element={<Patrimoine />} />
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
