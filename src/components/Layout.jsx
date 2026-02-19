import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import { apiFetch } from '../utils/api'
import './Layout.css'

function Layout() {
  const { user, logout } = useAuth()
  const [group, setGroup] = useState(null)
  const [showCode, setShowCode] = useState(false)

  useEffect(() => {
    apiFetch('/api/groups/mine')
      .then(r => r.json())
      .then(g => { if (g) setGroup(g) })
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
            <NavLink to="/biens">Biens</NavLink>
          </li>
          <li>
            <NavLink to="/equipe">Équipe</NavLink>
          </li>
        </ul>
        <div className="sidebar-footer">
          {group && (
            <div className="sidebar-group-section">
              <button className="sidebar-group" onClick={() => setShowCode(!showCode)} title="Voir le code d'invitation">
                {group.name}
              </button>
              {showCode && (
                <div className="sidebar-invite-code">
                  <span>Code : <strong>{group.invite_code}</strong></span>
                  <button className="sidebar-copy-btn" onClick={() => navigator.clipboard.writeText(group.invite_code)}>Copier</button>
                </div>
              )}
            </div>
          )}
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
