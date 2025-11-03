import { useState, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/products', label: 'Products', icon: '📦' },
    { path: '/orders', label: 'Orders', icon: '🛒' },
    { path: '/reports', label: 'Reports', icon: '📈' },
  ]

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2>Ultimate E-commerce</h2>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>
      </aside>
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {children}
      </main>
    </div>
  )
}

export default Layout

