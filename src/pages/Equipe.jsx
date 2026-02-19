import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch } from '../utils/api'
import './Equipe.css'

function Equipe() {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [ownerId, setOwnerId] = useState(null)
  const [inviteCode, setInviteCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(null)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch('/api/groups/members').then(r => r.json()),
      apiFetch('/api/groups/mine').then(r => r.json()),
    ])
      .then(([data, group]) => {
        setMembers(data.members)
        setOwnerId(data.owner_id)
        if (group) setInviteCode(group.invite_code)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isAdmin = user?.id === ownerId

  async function handleRemove(memberId) {
    if (!confirm('Voulez-vous vraiment retirer ce membre du groupe ?')) return
    setRemoving(memberId)
    try {
      const res = await apiFetch(`/api/groups/members/${memberId}`, { method: 'DELETE' })
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.id !== memberId))
      } else {
        const err = await res.json()
        alert(err.error || 'Erreur')
      }
    } catch {
      alert('Erreur réseau')
    } finally {
      setRemoving(null)
    }
  }

  async function handleResetCode() {
    if (!confirm('Voulez-vous vraiment réinitialiser le code d\'invitation ? L\'ancien code ne fonctionnera plus.')) return
    setResetting(true)
    try {
      const res = await apiFetch('/api/groups/reset-invite', { method: 'POST' })
      if (res.ok) {
        const group = await res.json()
        setInviteCode(group.invite_code)
      } else {
        const err = await res.json()
        alert(err.error || 'Erreur')
      }
    } catch {
      alert('Erreur réseau')
    } finally {
      setResetting(false)
    }
  }

  if (loading) return <div className="equipe"><p>Chargement...</p></div>

  return (
    <div className="equipe">
      <h1>Équipe</h1>
      <p className="equipe-count">{members.length} membre{members.length > 1 ? 's' : ''}</p>

      {isAdmin && inviteCode && (
        <div className="equipe-invite-section">
          <div className="equipe-invite-row">
            <span className="equipe-invite-label">Code d'invitation :</span>
            <span className="equipe-invite-code">{inviteCode}</span>
            <button className="equipe-invite-copy" onClick={() => navigator.clipboard.writeText(inviteCode)}>Copier</button>
          </div>
          <button
            className="equipe-reset-btn"
            onClick={handleResetCode}
            disabled={resetting}
          >
            {resetting ? 'Réinitialisation...' : 'Réinitialiser le code'}
          </button>
        </div>
      )}
      <div className="equipe-list">
        {members.map(member => (
          <div key={member.id} className="equipe-card">
            <div className="equipe-card-info">
              {member.avatar_url && (
                <img className="equipe-avatar" src={member.avatar_url} alt="" referrerPolicy="no-referrer" />
              )}
              {!member.avatar_url && (
                <div className="equipe-avatar-placeholder">{(member.name || member.email)[0].toUpperCase()}</div>
              )}
              <div className="equipe-details">
                <span className="equipe-name">{member.name || member.email}</span>
                <span className="equipe-email">{member.email}</span>
              </div>
              {member.id === ownerId && <span className="equipe-badge">Admin</span>}
            </div>
            {isAdmin && member.id !== user.id && (
              <button
                className="equipe-remove"
                onClick={() => handleRemove(member.id)}
                disabled={removing === member.id}
              >
                {removing === member.id ? 'Retrait...' : 'Retirer'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Equipe
