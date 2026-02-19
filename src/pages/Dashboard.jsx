import { useState, useEffect } from 'react'
import { apiFetch } from '../utils/api'
import './Dashboard.css'

function calcMensualite(amount, ratePercent, months) {
  if (!amount || !ratePercent || !months) return 0
  const r = ratePercent / 100 / 12
  return Math.round(amount * r / (1 - Math.pow(1 + r, -months)))
}

function formatPrice(n) {
  if (n == null) return '--'
  return Number(n).toLocaleString('fr-FR') + ' €'
}

function Dashboard() {
  const [patrimoine, setPatrimoine] = useState([])
  const [annonces, setAnnonces] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiFetch('/api/patrimoine').then(r => r.json()),
      apiFetch('/api/annonces').then(r => r.json()),
    ])
      .then(([p, a]) => { setPatrimoine(p); setAnnonces(a) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalBiens = patrimoine.length
  const biensLoues = patrimoine.filter(b => b.is_rented).length
  const biensVacants = totalBiens - biensLoues
  const tauxOccupation = totalBiens > 0 ? Math.round((biensLoues / totalBiens) * 100) : null

  const totalAchat = patrimoine.reduce((s, b) => s + (b.purchase_price || 0), 0)
  const totalLoyer = patrimoine.reduce((s, b) => s + (b.is_rented ? (b.monthly_rent || 0) : 0), 0)
  const totalMensualites = patrimoine.reduce((s, b) => s + calcMensualite(b.credit_amount, parseFloat(b.credit_rate), b.credit_duration_months), 0)
  const cashflow = totalLoyer - totalMensualites

  const rendementBrut = totalAchat > 0 ? ((totalLoyer * 12) / totalAchat * 100).toFixed(2) : null

  if (loading) return <div className="dashboard"><p>Chargement...</p></div>

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Patrimoine total</span>
          <span className="metric-value">{formatPrice(totalAchat || null)}</span>
          <span className="metric-sub">{totalBiens} bien{totalBiens > 1 ? 's' : ''}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Revenus locatifs</span>
          <span className="metric-value metric-positive">{totalLoyer > 0 ? formatPrice(totalLoyer) : '--'}</span>
          <span className="metric-sub">par mois</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Mensualités crédit</span>
          <span className="metric-value metric-negative">{totalMensualites > 0 ? formatPrice(totalMensualites) : '--'}</span>
          <span className="metric-sub">par mois</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Cash-flow mensuel</span>
          <span className={`metric-value ${cashflow >= 0 ? 'metric-positive' : 'metric-negative'}`}>
            {totalLoyer > 0 || totalMensualites > 0 ? formatPrice(cashflow) : '--'}
          </span>
          <span className="metric-sub">loyers - mensualités</span>
        </div>
      </div>

      <div className="metrics-grid dashboard-row-2">
        <div className="metric-card">
          <span className="metric-label">Rendement brut</span>
          <span className="metric-value">{rendementBrut != null ? rendementBrut + ' %' : '--'}</span>
          <span className="metric-sub">loyers annuels / prix d'achat</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Taux d'occupation</span>
          <span className="metric-value">{tauxOccupation != null ? tauxOccupation + ' %' : '--'}</span>
          <span className="metric-sub">{biensLoues} loué{biensLoues > 1 ? 's' : ''} / {biensVacants} vacant{biensVacants > 1 ? 's' : ''}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Annonces en suivi</span>
          <span className="metric-value">{annonces.length}</span>
          <span className="metric-sub">biens à l'étude</span>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
