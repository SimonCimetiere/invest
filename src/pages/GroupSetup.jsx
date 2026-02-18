import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './GroupSetup.css'

function GroupSetup() {
  const { createGroup, joinGroup, logout } = useAuth()
  const [tab, setTab] = useState('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const group = await createGroup(name)
      setCreatedCode(group.invite_code)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await joinGroup(code)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (createdCode) {
    return (
      <div className="group-page">
        <div className="group-card">
          <h1>Groupe cree !</h1>
          <p className="group-subtitle">Partagez ce code avec vos partenaires pour qu'ils rejoignent votre groupe :</p>
          <div className="group-code-display">{createdCode}</div>
          <button className="group-btn" onClick={() => navigator.clipboard.writeText(createdCode)}>
            Copier le code
          </button>
          <p className="group-hint">Ce code est aussi disponible dans votre espace.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="group-page">
      <div className="group-card">
        <h1>Rejoindre un groupe</h1>
        <p className="group-subtitle">Creez un nouveau groupe ou rejoignez un groupe existant avec un code d'invitation.</p>

        <div className="group-tabs">
          <button className={`group-tab ${tab === 'create' ? 'active' : ''}`} onClick={() => { setTab('create'); setError('') }}>
            Creer un groupe
          </button>
          <button className={`group-tab ${tab === 'join' ? 'active' : ''}`} onClick={() => { setTab('join'); setError('') }}>
            Rejoindre
          </button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate}>
            <div className="group-field">
              <label>Nom du groupe</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Projet Immobilier Paris"
                required
              />
            </div>
            <button className="group-btn" type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Creation...' : 'Creer le groupe'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin}>
            <div className="group-field">
              <label>Code d'invitation</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="Ex: ABC123"
                maxLength={6}
                required
              />
            </div>
            <button className="group-btn" type="submit" disabled={loading || !code.trim()}>
              {loading ? 'Connexion...' : 'Rejoindre le groupe'}
            </button>
          </form>
        )}

        {error && <p className="group-error">{error}</p>}

        <button className="group-logout" onClick={logout}>Se deconnecter</button>
      </div>
    </div>
  )
}

export default GroupSetup
