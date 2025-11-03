import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { reportsApi, SalesTrend, CategoryDistribution, TopProduct } from '../api/reports'
import './Reports.css'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300']

const Reports = () => {
  const [salesTrends, setSalesTrends] = useState<SalesTrend[]>([])
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    fetchReports()
  }, [days])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const [trends, categories, products] = await Promise.all([
        reportsApi.getSalesTrends(days),
        reportsApi.getCategoryDistribution(),
        reportsApi.getTopProducts(10, days),
      ])
      setSalesTrends(trends)
      setCategoryDistribution(categories)
      setTopProducts(products)
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return

    const headers = Object.keys(data[0])
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header]
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      }).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="loading">Loading reports...</div>
  }

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>Reports</h1>
        <div className="reports-controls">
          <label>
            Time Period:
            <select value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        </div>
      </div>

      <div className="reports-grid">
        <div className="report-card">
          <div className="report-header">
            <h2>Sales Trends</h2>
            <button
              className="export-btn"
              onClick={() => exportToCSV(salesTrends, 'sales-trends.csv')}
              aria-label="Export to CSV"
            >
              📥 Export CSV
            </button>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrends} aria-label="Sales trends over time">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue ($)" />
                <Line type="monotone" dataKey="order_count" stroke="#82ca9d" name="Orders" />
                <Line type="monotone" dataKey="units_sold" stroke="#ffc658" name="Units Sold" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="report-card">
          <div className="report-header">
            <h2>Category Distribution</h2>
            <button
              className="export-btn"
              onClick={() => exportToCSV(categoryDistribution, 'category-distribution.csv')}
              aria-label="Export to CSV"
            >
              📥 Export CSV
            </button>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryDistribution.slice(0, 10)} aria-label="Sales by category">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category_name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#8884d8" name="Revenue ($)" />
                <Bar dataKey="units_sold" fill="#82ca9d" name="Units Sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="report-card">
          <div className="report-header">
            <h2>Top Products</h2>
            <button
              className="export-btn"
              onClick={() => exportToCSV(topProducts, 'top-products.csv')}
              aria-label="Export to CSV"
            >
              📥 Export CSV
            </button>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts} layout="vertical" aria-label="Top selling products">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="title" type="category" width={150} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#8884d8" name="Revenue ($)" />
                <Bar dataKey="units_sold" fill="#82ca9d" name="Units Sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="report-card">
          <div className="report-header">
            <h2>Category Revenue Share</h2>
            <button
              className="export-btn"
              onClick={() => exportToCSV(categoryDistribution, 'category-revenue-share.csv')}
              aria-label="Export to CSV"
            >
              📥 Export CSV
            </button>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart aria-label="Revenue share by category">
                <Pie
                  data={categoryDistribution.slice(0, 8)}
                  dataKey="revenue"
                  nameKey="category_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ category_name, percent }) => `${category_name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryDistribution.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="reports-tables">
        <div className="report-card">
          <div className="report-header">
            <h2>Top Products Table</h2>
            <button
              className="export-btn"
              onClick={() => exportToCSV(topProducts, 'top-products-table.csv')}
              aria-label="Export to CSV"
            >
              📥 Export CSV
            </button>
          </div>
          <table className="report-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Orders</th>
                <th>Units Sold</th>
                <th>Revenue</th>
                <th>Avg Price</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product) => (
                <tr key={product.product_id}>
                  <td>{product.title || product.product_id}</td>
                  <td>{product.category_name || 'N/A'}</td>
                  <td>{product.order_count}</td>
                  <td>{product.units_sold}</td>
                  <td>${product.revenue.toFixed(2)}</td>
                  <td>${product.avg_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Reports

