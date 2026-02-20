import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from '../utils/api'
import './Finances.css'

const TYPES = [
  { value: 'loyer', label: 'Loyer', revenue: true },
  { value: 'charges_copro', label: 'Charges copro', revenue: false },
  { value: 'taxe_fonciere', label: 'Taxe fonciere', revenue: false },
  { value: 'assurance_pno', label: 'Assurance PNO', revenue: false },
  { value: 'travaux', label: 'Travaux', revenue: false },
  { value: 'comptable', label: 'Comptable', revenue: false },
  { value: 'autre_depense', label: 'Autre depense', revenue: false },
  { value: 'autre_revenu', label: 'Autre revenu', revenue: true },
]

const TYPE_LABELS = Object.fromEntries(TYPES.map(t => [t.value, t.label]))

function formatPrice(n) {
  if (n == null) return '--'
  return Number(n).toLocaleString('fr-FR') + ' €'
}

function formatSign(n) {
  if (n == null) return '--'
  const s = n > 0 ? '+' : ''
  return s + Number(n).toLocaleString('fr-FR') + ' €'
}

function Finances() {
  const [transactions, setTransactions] = useState([])
  const [biens, setBiens] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterBien, setFilterBien] = useState('')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterMonth, setFilterMonth] = useState('')
  const [sortKey, setSortKey] = useState('transaction_date')
  const [sortDir, setSortDir] = useState('desc')
  const [exportPeriod, setExportPeriod] = useState('annuel')
  const [exportLoading, setExportLoading] = useState(false)

  const emptyForm = {
    patrimoine_id: '', type: 'loyer', amount: '', transaction_date: new Date().toISOString().slice(0, 10),
    description: '', is_paid: false,
  }
  const [form, setForm] = useState(emptyForm)

  function loadData() {
    const txParams = new URLSearchParams()
    if (filterBien) txParams.set('patrimoine_id', filterBien)
    if (filterYear) txParams.set('year', filterYear)
    if (filterMonth) txParams.set('month', filterMonth)

    Promise.all([
      apiFetch(`/api/transactions?${txParams}`).then(r => r.json()),
      apiFetch('/api/patrimoine').then(r => r.json()),
      apiFetch('/api/finances/summary').then(r => r.json()),
    ]).then(([tx, p, s]) => {
      setTransactions(tx)
      setBiens(p)
      setSummary(s)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [filterBien, filterYear, filterMonth])

  async function handleAdd(e) {
    e.preventDefault()
    const typeInfo = TYPES.find(t => t.value === form.type)
    const amount = Math.abs(parseInt(form.amount))
    const signedAmount = typeInfo?.revenue ? amount : -amount

    const res = await apiFetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: signedAmount,
        patrimoine_id: parseInt(form.patrimoine_id),
      }),
    })
    if (res.ok) {
      setForm(emptyForm)
      setShowForm(false)
      loadData()
    }
  }

  async function togglePaid(tx) {
    const res = await apiFetch(`/api/transactions/${tx.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_paid: !tx.is_paid }),
    })
    if (res.ok) loadData()
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette transaction ?')) return
    const res = await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' })
    if (res.ok) loadData()
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  async function handleExport() {
    setExportLoading(true)
    try {
      const params = new URLSearchParams({ year: filterYear, period: exportPeriod })
      if (filterBien) params.set('patrimoine_id', filterBien)
      const res = await apiFetch(`/api/finances/bilan-pdf?${params}`)
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Erreur lors de la génération')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bilan_${exportPeriod}_${filterYear}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erreur réseau')
    } finally {
      setExportLoading(false)
    }
  }

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey]
      if (sortKey === 'patrimoine_title') { va = va || ''; vb = vb || '' }
      let cmp = 0
      if (typeof va === 'string' && typeof vb === 'string') cmp = va.localeCompare(vb, 'fr')
      else cmp = (va > vb ? 1 : va < vb ? -1 : 0)
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [transactions, sortKey, sortDir])

  const years = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear; y >= currentYear - 5; y--) years.push(y)

  const months = [
    { v: '', l: 'Tous' }, { v: '1', l: 'Janvier' }, { v: '2', l: 'Fevrier' }, { v: '3', l: 'Mars' },
    { v: '4', l: 'Avril' }, { v: '5', l: 'Mai' }, { v: '6', l: 'Juin' },
    { v: '7', l: 'Juillet' }, { v: '8', l: 'Aout' }, { v: '9', l: 'Septembre' },
    { v: '10', l: 'Octobre' }, { v: '11', l: 'Novembre' }, { v: '12', l: 'Decembre' },
  ]

  if (loading) return <div className="finances"><p>Chargement...</p></div>

  const g = summary?.global || {}

  return (
    <div className="finances">
      <h1>Finances</h1>

      {/* KPIs */}
      <div className="fin-metrics">
        <div className="fin-metric-card">
          <span className="fin-metric-label">Cash-flow global</span>
          <span className={`fin-metric-value ${g.cash_flow >= 0 ? 'metric-positive' : 'metric-negative'}`}>
            {formatSign(g.cash_flow)}
          </span>
        </div>
        <div className={`fin-metric-card ${g.impayes_count > 0 ? 'fin-metric-alert' : ''}`}>
          <span className="fin-metric-label">Loyers impayes</span>
          <span className={`fin-metric-value ${g.impayes_count > 0 ? 'metric-negative' : 'metric-positive'}`}>
            {g.impayes_count || 0}
          </span>
          {g.impayes_count > 0 && <span className="fin-metric-sub">{formatPrice(g.impayes_amount)}</span>}
        </div>
        <div className="fin-metric-card">
          <span className="fin-metric-label">Rendement brut</span>
          <span className="fin-metric-value">{g.rendement_brut?.toFixed(1) || '0'}%</span>
        </div>
        <div className="fin-metric-card">
          <span className="fin-metric-label">Rendement net</span>
          <span className={`fin-metric-value ${g.rendement_net >= 0 ? 'metric-positive' : 'metric-negative'}`}>
            {g.rendement_net?.toFixed(1) || '0'}%
          </span>
        </div>
      </div>

      {/* Filters + Add */}
      <div className="fin-toolbar">
        <div className="fin-filters">
          <select value={filterBien} onChange={e => setFilterBien(e.target.value)}>
            <option value="">Tous les biens</option>
            {biens.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
            {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </div>
        <div className="fin-toolbar-right">
          <div className="fin-export">
            <select value={exportPeriod} onChange={e => setExportPeriod(e.target.value)}>
              <option value="annuel">Année complète</option>
              <option value="T1">T1 (jan-mars)</option>
              <option value="T2">T2 (avr-juin)</option>
              <option value="T3">T3 (juil-sept)</option>
              <option value="T4">T4 (oct-dec)</option>
            </select>
            <button className="btn btn-outline" onClick={handleExport} disabled={exportLoading}>
              {exportLoading ? 'Export...' : 'Exporter le bilan'}
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Annuler' : 'Ajouter une transaction'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="fin-section">
          <h3>Nouvelle transaction</h3>
          <form onSubmit={handleAdd} className="fin-form">
            <div className="fin-form-grid">
              <div className="field">
                <label>Bien *</label>
                <select value={form.patrimoine_id} onChange={e => setForm(p => ({ ...p, patrimoine_id: e.target.value }))} required>
                  <option value="">Selectionner...</option>
                  {biens.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Type *</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Montant (€) *</label>
                <input type="number" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Date *</label>
                <input type="date" value={form.transaction_date} onChange={e => setForm(p => ({ ...p, transaction_date: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Description</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="field fin-paid-field">
                <label>
                  <input type="checkbox" checked={form.is_paid} onChange={e => setForm(p => ({ ...p, is_paid: e.target.checked }))} />
                  Paye
                </label>
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Ajouter</button>
          </form>
        </div>
      )}

      {/* Transactions table */}
      {transactions.length === 0 ? (
        <p className="empty-state">Aucune transaction enregistree.</p>
      ) : (
        <div className="fin-table-wrapper">
          <table className="fin-table">
            <thead>
              <tr>
                {[
                  { key: 'transaction_date', label: 'Date' },
                  { key: 'patrimoine_title', label: 'Bien' },
                  { key: 'type', label: 'Type' },
                  { key: 'description', label: 'Description' },
                  { key: 'amount', label: 'Montant' },
                  { key: 'is_paid', label: 'Statut' },
                ].map(col => (
                  <th key={col.key} className="fin-th-sortable" onClick={() => handleSort(col.key)}>
                    {col.label}
                    {sortKey === col.key && <span className="sort-arrow">{sortDir === 'asc' ? ' \u25B2' : ' \u25BC'}</span>}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map(tx => (
                <tr key={tx.id} className={!tx.is_paid && tx.type === 'loyer' ? 'fin-row-unpaid' : ''}>
                  <td>{new Date(tx.transaction_date).toLocaleDateString('fr-FR')}</td>
                  <td className="fin-cell-bien">{tx.patrimoine_title}</td>
                  <td><span className={`fin-type-badge ${tx.amount >= 0 ? 'fin-type-revenue' : 'fin-type-expense'}`}>{TYPE_LABELS[tx.type] || tx.type}</span></td>
                  <td className="fin-cell-desc">{tx.description || '--'}</td>
                  <td className={`fin-cell-amount ${tx.amount >= 0 ? 'metric-positive' : 'metric-negative'}`}>{formatSign(tx.amount)}</td>
                  <td>
                    <button className={`fin-status-btn ${tx.is_paid ? 'fin-status-paid' : 'fin-status-pending'}`} onClick={() => togglePaid(tx)}>
                      {tx.is_paid ? 'Paye' : 'En attente'}
                    </button>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(tx.id)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cash-flow par bien */}
      {summary?.per_bien?.length > 0 && (
        <div className="fin-section">
          <h3>Cash-flow par bien</h3>
          <div className="fin-table-wrapper">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Bien</th>
                  <th>Revenus</th>
                  <th>Depenses</th>
                  <th>Cash-flow</th>
                  <th>Rendement net</th>
                </tr>
              </thead>
              <tbody>
                {summary.per_bien.map(b => {
                  const rdt = b.purchase_price > 0 ? (b.cash_flow / b.purchase_price * 100) : 0
                  return (
                    <tr key={b.id}>
                      <td className="fin-cell-bien">{b.title}</td>
                      <td className="metric-positive">{formatPrice(b.total_revenus)}</td>
                      <td className="metric-negative">{formatPrice(Math.abs(b.total_depenses))}</td>
                      <td className={b.cash_flow >= 0 ? 'metric-positive' : 'metric-negative'}>{formatSign(b.cash_flow)}</td>
                      <td className={rdt >= 0 ? 'metric-positive' : 'metric-negative'}>{rdt.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default Finances
