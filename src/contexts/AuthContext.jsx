import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.exp * 1000 < Date.now()) {
          logout()
        } else {
          setUser({ id: payload.id, name: payload.name, email: payload.email, avatar_url: payload.avatar_url })
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
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
  }

  function logout() {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  if (loading) return null

  return (
    <AuthContext.Provider value={{ user, token, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
