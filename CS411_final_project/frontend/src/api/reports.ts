import api from './client'

export interface SalesTrend {
  date: string
  order_count: number
  revenue: number
  units_sold: number
}

export interface CategoryDistribution {
  category_name: string
  order_count: number
  units_sold: number
  revenue: number
}

export interface TopProduct {
  product_id: string
  title: string
  category_name?: string
  order_count: number
  units_sold: number
  revenue: number
  avg_price: number
}

export interface DashboardStats {
  today_revenue: number
  today_orders: number
  pending_orders: number
  low_stock: number
}

export const reportsApi = {
  getSalesTrends: async (days = 30): Promise<SalesTrend[]> => {
    const response = await api.get(`/reports/sales-trends?days=${days}`)
    return response.data
  },

  getCategoryDistribution: async (): Promise<CategoryDistribution[]> => {
    const response = await api.get('/reports/category-distribution')
    return response.data
  },

  getTopProducts: async (limit = 10, days = 30): Promise<TopProduct[]> => {
    const response = await api.get(`/reports/top-products?limit=${limit}&days=${days}`)
    return response.data
  },

  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/reports/dashboard-stats')
    return response.data
  },
}

