import { useEffect, useState } from 'react'
import { reportsApi, DashboardStats } from '../api/reports'
import { useDeltaPolling } from '../hooks/useDeltaPolling'
import './Dashboard.css'

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const data = await reportsApi.getDashboardStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  // Delta polling for real-time updates
  useDeltaPolling({
    enabled: true,
    interval: 5000,
    onChanges: (changes) => {
      // Refresh stats when changes detected
      if (changes.orders.length > 0 || changes.products.length > 0) {
        fetchStats()
      }
    }
  })

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-label">Today's Revenue</div>
            <div className="stat-value">${stats?.today_revenue.toFixed(2) || '0.00'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-label">Today's Orders</div>
            <div className="stat-value">{stats?.today_orders || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-label">Pending Orders</div>
            <div className="stat-value">{stats?.pending_orders || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-label">Low Stock Items</div>
            <div className="stat-value">{stats?.low_stock || 0}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

