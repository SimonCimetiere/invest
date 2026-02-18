import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

function Login() {
  const { loginWithGoogle } = useAuth()
  const googleBtnRef = useRef(null)
  const [error, setError] = useState('')
  const [clientId, setClientId] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch Google Client ID from server
  useEffect(() => {
    fetch('/api/auth/config')
      .then(r => r.json())
      .then(data => setClientId(data.googleClientId))
      .catch(() => setError('Impossible de charger la configuration'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!clientId || !window.google?.accounts) return

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        setError('')
        try {
          await loginWithGoogle(response.credential)
        } catch (err) {
          setError(err.message)
        }
      },
    })

    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'signin_with',
      locale: 'fr',
    })
  }, [clientId, loginWithGoogle])

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Investissement Locatif</h1>
        <p className="login-subtitle">Connectez-vous pour acceder a votre espace</p>
        {loading ? (
          <p className="login-loading">Chargement...</p>
        ) : !clientId ? (
          <p className="login-error">Google Sign-In non configure (GOOGLE_CLIENT_ID manquant)</p>
        ) : (
          <div className="google-btn-wrapper" ref={googleBtnRef}></div>
        )}
        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  )
}

export default Login
