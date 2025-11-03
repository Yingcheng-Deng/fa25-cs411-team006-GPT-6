import api from './client'

export interface OrderItem {
  order_item_id: number
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  freight_value: number
  product_title?: string
  category_name?: string
  available_qty?: number
}

export interface Order {
  order_id: string
  customer_id: string
  seller_id?: string
  status: string
  purchase_ts: string
  approved_at?: string
  delivered_carrier_date?: string
  delivered_customer_date?: string
  est_delivery_date?: string
  customer_name?: string
  customer_email?: string
  item_count?: number
  total_amount?: number
}

export interface OrderDetail extends Order {
  items: OrderItem[]
  payments: any[]
  status_history: any[]
}

export interface OrdersResponse {
  orders: Order[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export const ordersApi = {
  getAll: async (
    page = 1,
    limit = 20,
    status?: string,
    dateFrom?: string,
    dateTo?: string,
    customerId?: string
  ): Promise<OrdersResponse> => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() })
    if (status) params.append('status', status)
    if (dateFrom) params.append('date_from', dateFrom)
    if (dateTo) params.append('date_to', dateTo)
    if (customerId) params.append('customer_id', customerId)
    
    const response = await api.get(`/orders?${params}`)
    return response.data
  },

  getById: async (orderId: string): Promise<OrderDetail> => {
    const response = await api.get(`/orders/${orderId}`)
    return response.data
  },

  updateStatus: async (orderId: string, status: string, notes?: string): Promise<Order> => {
    const response = await api.put(`/orders/${orderId}/status`, { status, notes })
    return response.data
  },

  updateItem: async (orderId: string, itemId: number, updates: Partial<OrderItem>): Promise<OrderItem> => {
    const response = await api.put(`/orders/${orderId}/items/${itemId}`, updates)
    return response.data
  },

  cancel: async (orderId: string, notes?: string): Promise<void> => {
    await api.post(`/orders/${orderId}/cancel`, { notes })
  },

  refund: async (orderId: string, notes?: string): Promise<void> => {
    await api.post(`/orders/${orderId}/refund`, { notes })
  },
}

