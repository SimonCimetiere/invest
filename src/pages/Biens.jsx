import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch } from '../utils/api'
import './Biens.css'

const DPE_COLORS = {
  A: '#319834', B: '#33a357', C: '#51b74b', D: '#f0e30e',
  E: '#f0a30e', F: '#eb6120', G: '#d7221f',
}

function Biens() {
  const { user } = useAuth()
  const [annonces, setAnnonces] = useState([])
  const [loading, setLoading] = useState(true)

  // Add by URL
  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')

  // Manual form
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState({
    title: '', price: '', surface: '', location: '', rooms: '', bedrooms: '',
    external_url: '', source: 'autre', description: '', property_type: '',
    energy_rating: '', floor: '', charges: '',
  })

  // Edit modal
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})

  // Comments modal
  const [commentsAnnonceId, setCommentsAnnonceId] = useState(null)
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [commentCounts, setCommentCounts] = useState({}) // { annonceId: count }

  useEffect(() => {
    Promise.all([
      apiFetch('/api/annonces').then(r => r.json()),
      apiFetch('/api/comments/counts').then(r => r.json()),
    ])
      .then(([data, counts]) => {
        setAnnonces(data)
        setCommentCounts(counts)
      })
      .catch(err => console.error('Erreur chargement:', err))
      .finally(() => setLoading(false))
  }, [])

  // ---- Comments ----

  async function openCommentsModal(annonceId) {
    setCommentsAnnonceId(annonceId)
    setCommentInput('')
    setCommentsLoading(true)
    try {
      const res = await apiFetch(`/api/annonces/${annonceId}/comments`)
      const data = await res.json()
      setComments(data)
      setCommentCounts(prev => ({ ...prev, [annonceId]: data.length }))
    } catch (err) {
      console.error('Erreur chargement commentaires:', err)
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }

  function closeCommentsModal() {
    setCommentsAnnonceId(null)
    setComments([])
    setCommentInput('')
  }

  async function handleAddComment() {
    const content = commentInput.trim()
    if (!content || !commentsAnnonceId) return
    try {
      const res = await apiFetch(`/api/annonces/${commentsAnnonceId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const comment = await res.json()
      setComments(prev => [...prev, comment])
      setCommentCounts(prev => ({ ...prev, [commentsAnnonceId]: (prev[commentsAnnonceId] || 0) + 1 }))
      setCommentInput('')
    } catch (err) {
      console.error('Erreur ajout commentaire:', err)
    }
  }

  async function handleDeleteComment(commentId) {
    try {
      await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      setComments(prev => prev.filter(c => c.id !== commentId))
      setCommentCounts(prev => ({ ...prev, [commentsAnnonceId]: Math.max(0, (prev[commentsAnnonceId] || 1) - 1) }))
    } catch (err) {
      console.error('Erreur suppression commentaire:', err)
    }
  }

  // ---- URL / Manual / Edit ----

  async function handleAddByUrl(e) {
    e.preventDefault()
    if (!urlInput.trim()) return
    setUrlLoading(true)
    setUrlError('')
    try {
      const res = await apiFetch('/api/annonces/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      if (res.status === 409) {
        setUrlError('Cette annonce existe déjà dans votre liste.')
        return
      }
      if (!res.ok) throw new Error('Erreur serveur')
      const annonce = await res.json()
      setAnnonces(prev => [annonce, ...prev])
      setCommentCounts(prev => ({ ...prev, [annonce.id]: 0 }))
      setUrlInput('')
    } catch (err) {
      setUrlError("Impossible d'extraire les infos. Essayez l'ajout manuel.")
      console.error(err)
    } finally {
      setUrlLoading(false)
    }
  }

  async function handleManualAdd(e) {
    e.preventDefault()
    try {
      const res = await apiFetch('/api/annonces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...manual,
          price: manual.price ? parseInt(manual.price, 10) : null,
        }),
      })
      const annonce = await res.json()
      setAnnonces(prev => [annonce, ...prev])
      setCommentCounts(prev => ({ ...prev, [annonce.id]: 0 }))
      setManual({ title: '', price: '', surface: '', location: '', rooms: '', bedrooms: '', external_url: '', source: 'autre', description: '', property_type: '', energy_rating: '', floor: '', charges: '' })
      setShowManual(false)
    } catch (err) {
      console.error('Erreur ajout manuel:', err)
    }
  }

  async function handleDismiss(id) {
    try {
      await apiFetch(`/api/annonces/${id}/dismiss`, { method: 'PUT' })
      setAnnonces(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error('Erreur suppression:', err)
    }
  }

  function startEdit(ann) {
    setEditingId(ann.id)
    setEditData({
      title: ann.title || '', price: ann.price || '', surface: ann.surface || '',
      location: ann.location || '', rooms: ann.rooms || '', bedrooms: ann.bedrooms || '',
      description: ann.description || '', property_type: ann.property_type || '',
      energy_rating: ann.energy_rating || '', floor: ann.floor || '', charges: ann.charges || '',
    })
  }

  async function handleEditSave(e) {
    e.preventDefault()
    try {
      const res = await apiFetch(`/api/annonces/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editData,
          price: editData.price ? parseInt(editData.price, 10) : null,
        }),
      })
      const updated = await res.json()
      setAnnonces(prev => prev.map(a => a.id === editingId ? updated : a))
      setEditingId(null)
    } catch (err) {
      console.error('Erreur modification:', err)
    }
  }

  const commentsAnnonce = annonces.find(a => a.id === commentsAnnonceId)

  return (
    <div className="biens">
      <h1>Mes biens potentiels</h1>

      {/* Add by URL */}
      <section className="biens-section">
        <h2>Ajouter une annonce</h2>
        <form className="url-form" onSubmit={handleAddByUrl}>
          <input
            type="url"
            className="search-input"
            value={urlInput}
            onChange={e => { setUrlInput(e.target.value); setUrlError('') }}
            placeholder="Collez l'URL d'une annonce (leboncoin, seloger, etc.)"
            disabled={urlLoading}
          />
          <button type="submit" className="btn btn-primary" disabled={urlLoading || !urlInput.trim()}>
            {urlLoading ? 'Extraction...' : 'Ajouter'}
          </button>
        </form>
        {urlError && <p className="url-error">{urlError}</p>}
        <button
          type="button"
          className="btn btn-outline btn-sm manual-toggle"
          onClick={() => setShowManual(!showManual)}
        >
          {showManual ? 'Masquer le formulaire manuel' : 'Ajout manuel'}
        </button>
        {showManual && (
          <form className="manual-form" onSubmit={handleManualAdd}>
            <div className="manual-grid">
              <div className="field"><label>Titre</label><input type="text" value={manual.title} onChange={e => setManual(p => ({ ...p, title: e.target.value }))} /></div>
              <div className="field"><label>Prix (€)</label><input type="number" value={manual.price} onChange={e => setManual(p => ({ ...p, price: e.target.value }))} /></div>
              <div className="field"><label>Surface</label><input type="text" value={manual.surface} onChange={e => setManual(p => ({ ...p, surface: e.target.value }))} placeholder="ex: 65 m²" /></div>
              <div className="field"><label>Localisation</label><input type="text" value={manual.location} onChange={e => setManual(p => ({ ...p, location: e.target.value }))} /></div>
              <div className="field"><label>Pièces</label><input type="text" value={manual.rooms} onChange={e => setManual(p => ({ ...p, rooms: e.target.value }))} placeholder="ex: 3 pièces" /></div>
              <div className="field"><label>Chambres</label><input type="text" value={manual.bedrooms} onChange={e => setManual(p => ({ ...p, bedrooms: e.target.value }))} placeholder="ex: 2 chambres" /></div>
              <div className="field"><label>Type de bien</label><input type="text" value={manual.property_type} onChange={e => setManual(p => ({ ...p, property_type: e.target.value }))} placeholder="ex: Appartement" /></div>
              <div className="field"><label>Source</label>
                <select value={manual.source} onChange={e => setManual(p => ({ ...p, source: e.target.value }))}>
                  <option value="leboncoin">Leboncoin</option><option value="seloger">SeLoger</option><option value="autre">Autre</option>
                </select>
              </div>
              <div className="field"><label>DPE</label>
                <select value={manual.energy_rating} onChange={e => setManual(p => ({ ...p, energy_rating: e.target.value }))}>
                  <option value="">—</option>{['A','B','C','D','E','F','G'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="field"><label>Étage</label><input type="text" value={manual.floor} onChange={e => setManual(p => ({ ...p, floor: e.target.value }))} placeholder="ex: 3e étage" /></div>
              <div className="field"><label>Charges</label><input type="text" value={manual.charges} onChange={e => setManual(p => ({ ...p, charges: e.target.value }))} placeholder="ex: 150 €/mois" /></div>
              <div className="field full-width"><label>URL de l'annonce</label><input type="url" value={manual.external_url} onChange={e => setManual(p => ({ ...p, external_url: e.target.value }))} /></div>
              <div className="field full-width"><label>Description</label><textarea rows={3} value={manual.description} onChange={e => setManual(p => ({ ...p, description: e.target.value }))} /></div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Ajouter</button>
          </form>
        )}
      </section>

      {/* Annonces list */}
      <section className="biens-section">
        <h2>Annonces ({annonces.length})</h2>
        {loading && <p>Chargement...</p>}
        {!loading && annonces.length === 0 && (
          <p className="empty-state">Aucune annonce pour le moment.</p>
        )}
        <div className="annonces-grid">
          {annonces.map(ann => (
            <div key={ann.id} className="annonce-card">
              {ann.image_url && (
                <div className="annonce-image">
                  <img src={ann.image_url} alt={ann.title || 'Annonce'} loading="lazy" />
                </div>
              )}
              <div className="annonce-body">
                <div className="annonce-top-row">
                  <span className={`source-badge source-${ann.source}`}>{ann.source}</span>
                  {ann.property_type && <span className="type-badge">{ann.property_type}</span>}
                  {ann.energy_rating && (
                    <span className="dpe-badge" style={{ backgroundColor: DPE_COLORS[ann.energy_rating] || '#94a3b8' }}>
                      DPE {ann.energy_rating}
                    </span>
                  )}
                </div>

                {ann.price && <div className="annonce-price">{ann.price.toLocaleString('fr-FR')} €</div>}

                <h3 className="annonce-title">{ann.title || 'Sans titre'}</h3>

                <div className="annonce-tags">
                  {ann.location && <span className="tag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>{ann.location}</span>}
                  {ann.surface && <span className="tag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>{ann.surface}</span>}
                  {ann.rooms && <span className="tag">{ann.rooms}</span>}
                  {ann.bedrooms && <span className="tag">{ann.bedrooms}</span>}
                  {ann.floor && <span className="tag">{ann.floor}</span>}
                  {ann.charges && <span className="tag">Charges : {ann.charges}</span>}
                </div>

                {ann.description && <p className="annonce-desc">{ann.description}</p>}

                <div className="annonce-footer">
                  <span className="annonce-date">{new Date(ann.created_at).toLocaleDateString('fr-FR')}</span>
                  <div className="annonce-actions">
                    <button onClick={() => openCommentsModal(ann.id)} className="btn btn-outline btn-sm">
                      Commentaires{commentCounts[ann.id] > 0 && ` (${commentCounts[ann.id]})`}
                    </button>
                    {ann.external_url && (
                      <a href={ann.external_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Voir</a>
                    )}
                    <button onClick={() => startEdit(ann)} className="btn btn-outline btn-sm">Modifier</button>
                    <button onClick={() => handleDismiss(ann.id)} className="btn btn-danger btn-sm">Supprimer</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Edit modal */}
      {editingId && (
        <div className="modal-overlay" onClick={() => setEditingId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Modifier l'annonce</h3>
            <form onSubmit={handleEditSave}>
              <div className="manual-grid">
                <div className="field"><label>Titre</label><input type="text" value={editData.title} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))} /></div>
                <div className="field"><label>Prix (€)</label><input type="number" value={editData.price} onChange={e => setEditData(p => ({ ...p, price: e.target.value }))} /></div>
                <div className="field"><label>Surface</label><input type="text" value={editData.surface} onChange={e => setEditData(p => ({ ...p, surface: e.target.value }))} /></div>
                <div className="field"><label>Localisation</label><input type="text" value={editData.location} onChange={e => setEditData(p => ({ ...p, location: e.target.value }))} /></div>
                <div className="field"><label>Pièces</label><input type="text" value={editData.rooms} onChange={e => setEditData(p => ({ ...p, rooms: e.target.value }))} /></div>
                <div className="field"><label>Chambres</label><input type="text" value={editData.bedrooms} onChange={e => setEditData(p => ({ ...p, bedrooms: e.target.value }))} /></div>
                <div className="field"><label>Type de bien</label><input type="text" value={editData.property_type} onChange={e => setEditData(p => ({ ...p, property_type: e.target.value }))} /></div>
                <div className="field"><label>DPE</label>
                  <select value={editData.energy_rating} onChange={e => setEditData(p => ({ ...p, energy_rating: e.target.value }))}>
                    <option value="">—</option>{['A','B','C','D','E','F','G'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="field"><label>Étage</label><input type="text" value={editData.floor} onChange={e => setEditData(p => ({ ...p, floor: e.target.value }))} /></div>
                <div className="field"><label>Charges</label><input type="text" value={editData.charges} onChange={e => setEditData(p => ({ ...p, charges: e.target.value }))} /></div>
                <div className="field full-width"><label>Description</label><textarea rows={4} value={editData.description} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setEditingId(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comments modal */}
      {commentsAnnonceId && (
        <div className="modal-overlay" onClick={closeCommentsModal}>
          <div className="modal comments-modal" onClick={e => e.stopPropagation()}>
            <div className="comments-modal-header">
              <h3>Commentaires</h3>
              {commentsAnnonce && (
                <p className="comments-modal-annonce">{commentsAnnonce.title || 'Sans titre'}</p>
              )}
              <button className="modal-close" onClick={closeCommentsModal}>&times;</button>
            </div>

            {commentsLoading ? (
              <p>Chargement...</p>
            ) : (
              <>
                <div className="comments-list">
                  {comments.length === 0 && (
                    <p className="comments-empty">Aucun commentaire pour le moment. Soyez le premier !</p>
                  )}
                  {comments.map(c => (
                    <div key={c.id} className="comment">
                      <div className="comment-header">
                        <span className="comment-author">{c.username}</span>
                        <span className="comment-date">{new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        {c.user_id === user?.id && (
                          <button className="comment-delete" onClick={() => handleDeleteComment(c.id)} title="Supprimer">&times;</button>
                        )}
                      </div>
                      <p className="comment-content">{c.content}</p>
                    </div>
                  ))}
                </div>
                <div className="comment-form">
                  <input
                    type="text"
                    className="comment-input"
                    placeholder="Ajouter un commentaire..."
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddComment() }}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleAddComment} disabled={!commentInput.trim()}>Envoyer</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Biens
