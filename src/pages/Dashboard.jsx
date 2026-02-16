import './Dashboard.css'

function Dashboard() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Budget total</span>
          <span className="metric-value">--</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Rendement brut</span>
          <span className="metric-value">--</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Cash-flow mensuel</span>
          <span className="metric-value">--</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Biens en suivi</span>
          <span className="metric-value">--</span>
        </div>
      </div>
      <p className="dashboard-hint">
        Les métriques seront connectées prochainement.
      </p>
    </div>
  )
}

export default Dashboard
