import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from '../utils/api'
import './Patrimoine.css'

const emptyForm = {
  title: '', address: '', purchase_price: '', is_rented: false,
  monthly_rent: '', lease_start_date: '', lease_duration_months: '',
  credit_amount: '', credit_rate: '', credit_duration_months: '',
}

function calcMensualite(amount, ratePercent, months) {
  if (!amount || !ratePercent || !months) return null
  const r = ratePercent / 100 / 12
  return Math.round(amount * r / (1 - Math.pow(1 + r, -months)))
}

function formatPrice(n) {
  if (!n) return '--'
  return Number(n).toLocaleString('fr-FR') + ' €'
}

function calcLeaseEnd(startDate, durationMonths) {
  if (!startDate || !durationMonths) return null
  const d = new Date(startDate)
  d.setMonth(d.getMonth() + parseInt(durationMonths))
  return d
}

const TWO_MONTHS_MS = 2 * 30 * 24 * 60 * 60 * 1000

const COLUMNS = [
  { key: 'title', label: 'Bien' },
  { key: 'address', label: 'Adresse' },
  { key: 'purchase_price', label: "Prix d'achat" },
  { key: 'is_rented', label: 'Statut' },
  { key: 'monthly_rent', label: 'Loyer' },
  { key: 'lease_end', label: 'Fin de bail' },
  { key: 'credit_amount', label: 'Credit' },
  { key: 'mensualite', label: 'Mensualite' },
]

function getSortValue(bien, key) {
  if (key === 'lease_end') {
    const end = calcLeaseEnd(bien.lease_start_date, bien.lease_duration_months)
    return end ? end.getTime() : 0
  }
  if (key === 'mensualite') {
    return calcMensualite(bien.credit_amount, parseFloat(bien.credit_rate), bien.credit_duration_months) || 0
  }
  const v = bien[key]
  if (v == null) return typeof v === 'string' ? '' : 0
  return v
}

function Patrimoine() {
  const [biens, setBiens] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState(emptyForm)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [bailBien, setBailBien] = useState(null)
  const [bailForm, setBailForm] = useState({})
  const [bailLoading, setBailLoading] = useState(false)

  useEffect(() => {
    apiFetch('/api/patrimoine')
      .then(r => r.json())
      .then(data => setBiens(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedBiens = useMemo(() => {
    if (!sortKey) return biens
    return [...biens].sort((a, b) => {
      const va = getSortValue(a, sortKey)
      const vb = getSortValue(b, sortKey)
      let cmp = 0
      if (typeof va === 'string' && typeof vb === 'string') {
        cmp = va.localeCompare(vb, 'fr')
      } else {
        cmp = (va > vb ? 1 : va < vb ? -1 : 0)
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [biens, sortKey, sortDir])

  async function handleAdd(e) {
    e.preventDefault()
    const res = await apiFetch('/api/patrimoine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        purchase_price: parseInt(form.purchase_price) || null,
        monthly_rent: parseInt(form.monthly_rent) || null,
        lease_start_date: form.lease_start_date || null,
        lease_duration_months: parseInt(form.lease_duration_months) || null,
        credit_amount: parseInt(form.credit_amount) || null,
        credit_rate: parseFloat(form.credit_rate) || null,
        credit_duration_months: parseInt(form.credit_duration_months) || null,
      }),
    })
    if (res.ok) {
      const bien = await res.json()
      setBiens(prev => [bien, ...prev])
      setForm(emptyForm)
      setShowForm(false)
    }
  }

  function openEdit(bien) {
    setEditingId(bien.id)
    setEditData({
      title: bien.title || '',
      address: bien.address || '',
      purchase_price: bien.purchase_price || '',
      is_rented: bien.is_rented || false,
      monthly_rent: bien.monthly_rent || '',
      lease_start_date: bien.lease_start_date ? bien.lease_start_date.slice(0, 10) : '',
      lease_duration_months: bien.lease_duration_months || '',
      credit_amount: bien.credit_amount || '',
      credit_rate: bien.credit_rate || '',
      credit_duration_months: bien.credit_duration_months || '',
    })
  }

  async function handleEdit(e) {
    e.preventDefault()
    const res = await apiFetch(`/api/patrimoine/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editData,
        purchase_price: parseInt(editData.purchase_price) || null,
        monthly_rent: parseInt(editData.monthly_rent) || null,
        lease_start_date: editData.lease_start_date || null,
        lease_duration_months: parseInt(editData.lease_duration_months) || null,
        credit_amount: parseInt(editData.credit_amount) || null,
        credit_rate: parseFloat(editData.credit_rate) || null,
        credit_duration_months: parseInt(editData.credit_duration_months) || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setBiens(prev => prev.map(b => b.id === updated.id ? updated : b))
      setEditingId(null)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce bien ?')) return
    const res = await apiFetch(`/api/patrimoine/${id}`, { method: 'DELETE' })
    if (res.ok) setBiens(prev => prev.filter(b => b.id !== id))
  }

  function openBail(bien) {
    const today = new Date().toISOString().slice(0, 10)
    setBailBien(bien)
    setBailForm({
      type: 'vide',
      bailleur_nom: '',
      bailleur_adresse: '',
      locataire_nom: '',
      locataire_adresse_precedente: '',
      bien_adresse: bien.address || '',
      bien_description: '',
      bien_surface: '',
      date_debut: bien.lease_start_date ? bien.lease_start_date.slice(0, 10) : today,
      duree: '3 ans',
      loyer: bien.monthly_rent || '',
      charges: '',
      depot_garantie: bien.monthly_rent || '',
      mode_paiement: 'virement bancaire',
      inventaire_meubles: '',
      lieu_signature: '',
      date_signature: today,
    })
  }

  function handleBailTypeChange(type) {
    const isMeuble = type === 'meuble'
    setBailForm(f => ({
      ...f,
      type,
      duree: isMeuble ? '1 an' : '3 ans',
      depot_garantie: isMeuble ? (f.loyer ? String(Number(f.loyer) * 2) : '') : (f.loyer || ''),
    }))
  }

  async function handleBailSubmit(e) {
    e.preventDefault()
    setBailLoading(true)
    try {
      const res = await apiFetch(`/api/patrimoine/${bailBien.id}/bail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bailForm),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Erreur lors de la génération')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bail_${(bailBien.title || 'bien').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setBailBien(null)
    } catch {
      alert('Erreur réseau')
    } finally {
      setBailLoading(false)
    }
  }

  function renderForm(data, setData, onSubmit, submitLabel) {
    return (
      <form onSubmit={onSubmit} className="patrimoine-form">
        <div className="patrimoine-grid">
          <div className="field">
            <label>Titre *</label>
            <input value={data.title} onChange={e => setData(p => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Adresse</label>
            <input value={data.address} onChange={e => setData(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="field">
            <label>Prix d'achat (€)</label>
            <input type="number" value={data.purchase_price} onChange={e => setData(p => ({ ...p, purchase_price: e.target.value }))} />
          </div>
          <div className="field patrimoine-rented-field">
            <label>
              <input type="checkbox" checked={data.is_rented} onChange={e => setData(p => ({ ...p, is_rented: e.target.checked }))} />
              Actuellement loué
            </label>
          </div>
          {data.is_rented && (
            <>
              <div className="field">
                <label>Loyer mensuel (€)</label>
                <input type="number" value={data.monthly_rent} onChange={e => setData(p => ({ ...p, monthly_rent: e.target.value }))} />
              </div>
              <div className="field">
                <label>Date de debut du bail</label>
                <input type="date" value={data.lease_start_date} onChange={e => setData(p => ({ ...p, lease_start_date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Duree du bail (mois)</label>
                <input type="number" value={data.lease_duration_months} onChange={e => setData(p => ({ ...p, lease_duration_months: e.target.value }))} />
              </div>
            </>
          )}
          <div className="field">
            <label>Montant du crédit (€)</label>
            <input type="number" value={data.credit_amount} onChange={e => setData(p => ({ ...p, credit_amount: e.target.value }))} />
          </div>
          <div className="field">
            <label>Taux annuel (%)</label>
            <input type="number" step="0.01" value={data.credit_rate} onChange={e => setData(p => ({ ...p, credit_rate: e.target.value }))} />
          </div>
          <div className="field">
            <label>Durée du crédit (mois)</label>
            <input type="number" value={data.credit_duration_months} onChange={e => setData(p => ({ ...p, credit_duration_months: e.target.value }))} />
          </div>
        </div>
        <div className="patrimoine-form-actions">
          <button type="submit" className="btn btn-primary">{submitLabel}</button>
        </div>
      </form>
    )
  }

  if (loading) return <div className="patrimoine"><p>Chargement...</p></div>

  const now = new Date()

  return (
    <div className="patrimoine">
      <h1>Patrimoine</h1>

      <button className="btn btn-primary patrimoine-add-toggle" onClick={() => setShowForm(!showForm)}>
        {showForm ? 'Annuler' : 'Ajouter un bien'}
      </button>

      {showForm && (
        <div className="patrimoine-section">
          <h3>Nouveau bien</h3>
          {renderForm(form, setForm, handleAdd, 'Ajouter')}
        </div>
      )}

      {biens.length === 0 ? (
        <p className="empty-state">Aucun bien dans votre patrimoine.</p>
      ) : (
        <div className="patrimoine-table-wrapper">
          <table className="patrimoine-table">
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.key} className="patrimoine-th-sortable" onClick={() => handleSort(col.key)}>
                    {col.label}
                    {sortKey === col.key && <span className="sort-arrow">{sortDir === 'asc' ? ' \u25B2' : ' \u25BC'}</span>}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedBiens.map(bien => {
                const mensualite = calcMensualite(bien.credit_amount, parseFloat(bien.credit_rate), bien.credit_duration_months)
                const leaseEnd = calcLeaseEnd(bien.lease_start_date, bien.lease_duration_months)
                const isExpired = leaseEnd && leaseEnd < now
                const isExpiringSoon = leaseEnd && !isExpired && (leaseEnd.getTime() - now.getTime()) < TWO_MONTHS_MS
                return (
                  <tr key={bien.id}>
                    <td className="patrimoine-cell-title">{bien.title}</td>
                    <td className="patrimoine-cell-address">{bien.address || '--'}</td>
                    <td className="patrimoine-cell-price">{formatPrice(bien.purchase_price)}</td>
                    <td>
                      <span className={`patrimoine-status ${bien.is_rented ? 'status-rented' : 'status-vacant'}`}>
                        {bien.is_rented ? 'Loue' : 'Vacant'}
                      </span>
                    </td>
                    <td className="patrimoine-cell-rent">{bien.is_rented ? formatPrice(bien.monthly_rent) : '--'}</td>
                    <td className="patrimoine-cell-lease">
                      {leaseEnd ? (
                        <span className={isExpired ? 'lease-expired' : isExpiringSoon ? 'lease-warning' : ''}>
                          {leaseEnd.toLocaleDateString('fr-FR')}
                        </span>
                      ) : '--'}
                    </td>
                    <td className="patrimoine-cell-credit">
                      {bien.credit_amount ? (
                        <>{formatPrice(bien.credit_amount)}<br /><span className="patrimoine-credit-info">{bien.credit_rate}% / {bien.credit_duration_months} mois</span></>
                      ) : '--'}
                    </td>
                    <td className="patrimoine-cell-mensualite">{mensualite ? formatPrice(mensualite) : '--'}</td>
                    <td className="patrimoine-cell-actions">
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(bien)}>Modifier</button>
                      <button className="btn btn-sm btn-outline" onClick={() => openBail(bien)}>Bail</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(bien.id)}>Supprimer</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingId && (
        <div className="modal-overlay" onClick={() => setEditingId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Modifier le bien</h3>
            {renderForm(editData, setEditData, handleEdit, 'Enregistrer')}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setEditingId(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {bailBien && (
        <div className="modal-overlay" onClick={() => !bailLoading && setBailBien(null)}>
          <div className="modal modal-bail" onClick={e => e.stopPropagation()}>
            <h3>Générer un bail — {bailBien.title}</h3>
            <form onSubmit={handleBailSubmit}>
              <div className="bail-section">
                <h4>Type de bail</h4>
                <div className="bail-grid">
                  <div className="field">
                    <label>Type</label>
                    <select value={bailForm.type} onChange={e => handleBailTypeChange(e.target.value)}>
                      <option value="vide">Location vide</option>
                      <option value="meuble">Location meublée</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bail-section">
                <h4>Bailleur</h4>
                <div className="bail-grid">
                  <div className="field">
                    <label>Nom *</label>
                    <input value={bailForm.bailleur_nom} onChange={e => setBailForm(f => ({ ...f, bailleur_nom: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>Adresse *</label>
                    <input value={bailForm.bailleur_adresse} onChange={e => setBailForm(f => ({ ...f, bailleur_adresse: e.target.value }))} required />
                  </div>
                </div>
              </div>

              <div className="bail-section">
                <h4>Locataire</h4>
                <div className="bail-grid">
                  <div className="field">
                    <label>Nom *</label>
                    <input value={bailForm.locataire_nom} onChange={e => setBailForm(f => ({ ...f, locataire_nom: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>Adresse précédente *</label>
                    <input value={bailForm.locataire_adresse_precedente} onChange={e => setBailForm(f => ({ ...f, locataire_adresse_precedente: e.target.value }))} required />
                  </div>
                </div>
              </div>

              <div className="bail-section">
                <h4>Bien</h4>
                <div className="bail-grid">
                  <div className="field">
                    <label>Adresse *</label>
                    <input value={bailForm.bien_adresse} onChange={e => setBailForm(f => ({ ...f, bien_adresse: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>Surface (m²)</label>
                    <input value={bailForm.bien_surface} onChange={e => setBailForm(f => ({ ...f, bien_surface: e.target.value }))} />
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Description</label>
                    <textarea rows={2} value={bailForm.bien_description} onChange={e => setBailForm(f => ({ ...f, bien_description: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="bail-section">
                <h4>Conditions</h4>
                <div className="bail-grid">
                  <div className="field">
                    <label>Date de début *</label>
                    <input type="date" value={bailForm.date_debut} onChange={e => setBailForm(f => ({ ...f, date_debut: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>Durée</label>
                    <input value={bailForm.duree} onChange={e => setBailForm(f => ({ ...f, duree: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Loyer mensuel (€) *</label>
                    <input type="number" value={bailForm.loyer} onChange={e => setBailForm(f => ({ ...f, loyer: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>Charges (€/mois)</label>
                    <input type="number" value={bailForm.charges} onChange={e => setBailForm(f => ({ ...f, charges: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Dépôt de garantie (€) *</label>
                    <input type="number" value={bailForm.depot_garantie} onChange={e => setBailForm(f => ({ ...f, depot_garantie: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>Mode de paiement</label>
                    <select value={bailForm.mode_paiement} onChange={e => setBailForm(f => ({ ...f, mode_paiement: e.target.value }))}>
                      <option value="virement bancaire">Virement bancaire</option>
                      <option value="prélèvement automatique">Prélèvement automatique</option>
                      <option value="chèque">Chèque</option>
                      <option value="espèces">Espèces</option>
                    </select>
                  </div>
                </div>
              </div>

              {bailForm.type === 'meuble' && (
                <div className="bail-section">
                  <h4>Inventaire du mobilier</h4>
                  <div className="field">
                    <textarea rows={4} value={bailForm.inventaire_meubles} onChange={e => setBailForm(f => ({ ...f, inventaire_meubles: e.target.value }))} placeholder="Liste du mobilier fourni..." />
                  </div>
                </div>
              )}

              <div className="bail-section">
                <h4>Signature</h4>
                <div className="bail-grid">
                  <div className="field">
                    <label>Lieu</label>
                    <input value={bailForm.lieu_signature} onChange={e => setBailForm(f => ({ ...f, lieu_signature: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Date</label>
                    <input type="date" value={bailForm.date_signature} onChange={e => setBailForm(f => ({ ...f, date_signature: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setBailBien(null)} disabled={bailLoading}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={bailLoading}>
                  {bailLoading ? 'Génération...' : 'Générer le bail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Patrimoine
