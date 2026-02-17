import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Layout.css'

function Layout() {
  const { user, logout } = useAuth()

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
          <span className="sidebar-user">{user?.username}</span>
          <button className="sidebar-logout" onClick={logout}>Deconnexion</button>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
