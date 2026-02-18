import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import { apiFetch } from '../utils/api'
import './Layout.css'

function Layout() {
  const { user, logout } = useAuth()
  const [groupName, setGroupName] = useState('')

  useEffect(() => {
    apiFetch('/api/groups/mine')
      .then(r => r.json())
      .then(g => { if (g?.name) setGroupName(g.name) })
      .catch(() => {})
  }, [])

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>Investissement Locatif</h2>
        </div>
        <ul className="nav-links">
          <li>
            <NavLink to="/" end>Dashboard</NavLink>
          </li>
          <li>
            <NavLink to="/questionnaire">Questionnaire</NavLink>
          </li>
          <li>
            <NavLink to="/simulateur">Simulateur</NavLink>
          </li>
          <li>
            <NavLink to="/biens">Biens</NavLink>
          </li>
          <li>
            <NavLink to="/financement">Financement</NavLink>
          </li>
          <li>
            <NavLink to="/fiscalite">Fiscalité</NavLink>
          </li>
        </ul>
        <div className="sidebar-footer">
          {groupName && <span className="sidebar-group">{groupName}</span>}
          <div className="sidebar-user-row">
            {user?.avatar_url && <img className="sidebar-avatar" src={user.avatar_url} alt="" referrerPolicy="no-referrer" />}
            <span className="sidebar-user">{user?.name || user?.email}</span>
            <button className="sidebar-logout" onClick={logout}>Deconnexion</button>
          </div>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
