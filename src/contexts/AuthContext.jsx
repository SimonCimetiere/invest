import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token')
  return fetch(url, {
    ...options,
    headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  function updateToken(newToken) {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    const payload = JSON.parse(atob(newToken.split('.')[1]))
    setUser({ id: payload.id, name: payload.name, email: payload.email, avatar_url: payload.avatar_url, group_id: payload.group_id })
  }

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.exp * 1000 < Date.now()) {
          logout()
        } else {
          setUser({ id: payload.id, name: payload.name, email: payload.email, avatar_url: payload.avatar_url, group_id: payload.group_id })
        }
      } catch {
        logout()
      }
    }
    setLoading(false)
  }, [token])

  async function loginWithGoogle(credential) {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erreur de connexion')
    }
    const data = await res.json()
    updateToken(data.token)
  }

  async function createGroup(name) {
    const res = await apiFetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erreur creation groupe')
    }
    const data = await res.json()
    updateToken(data.token)
    return data.group
  }

  async function joinGroup(code) {
    const res = await apiFetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erreur pour rejoindre le groupe')
    }
    const data = await res.json()
    updateToken(data.token)
    return data.group
  }

  function logout() {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  if (loading) return null

  return (
    <AuthContext.Provider value={{ user, token, loginWithGoogle, logout, createGroup, joinGroup }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
