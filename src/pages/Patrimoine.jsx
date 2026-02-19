import { useState, useEffect } from 'react'
import { apiFetch } from '../utils/api'
import './Patrimoine.css'

const emptyForm = {
  title: '', address: '', purchase_price: '', is_rented: false,
  monthly_rent: '', credit_amount: '', credit_rate: '', credit_duration_months: '',
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

function Patrimoine() {
  const [biens, setBiens] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState(emptyForm)

  useEffect(() => {
    apiFetch('/api/patrimoine')
      .then(r => r.json())
      .then(data => setBiens(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    const res = await apiFetch('/api/patrimoine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        purchase_price: parseInt(form.purchase_price) || null,
        monthly_rent: parseInt(form.monthly_rent) || null,
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
            <div className="field">
              <label>Loyer mensuel (€)</label>
              <input type="number" value={data.monthly_rent} onChange={e => setData(p => ({ ...p, monthly_rent: e.target.value }))} />
            </div>
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
                <th>Bien</th>
                <th>Adresse</th>
                <th>Prix d'achat</th>
                <th>Statut</th>
                <th>Loyer</th>
                <th>Credit</th>
                <th>Mensualite</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {biens.map(bien => {
                const mensualite = calcMensualite(bien.credit_amount, parseFloat(bien.credit_rate), bien.credit_duration_months)
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
                    <td className="patrimoine-cell-credit">
                      {bien.credit_amount ? (
                        <>{formatPrice(bien.credit_amount)}<br /><span className="patrimoine-credit-info">{bien.credit_rate}% / {bien.credit_duration_months} mois</span></>
                      ) : '--'}
                    </td>
                    <td className="patrimoine-cell-mensualite">{mensualite ? formatPrice(mensualite) : '--'}</td>
                    <td className="patrimoine-cell-actions">
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(bien)}>Modifier</button>
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
    </div>
  )
}

export default Patrimoine
