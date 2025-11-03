import api from './client'

export interface DeltaChanges {
  products: Array<{ product_id: string; updated_at: string }>
  orders: Array<{ order_id: string; updated_at: string; status: string }>
  audit: any[]
}

export interface DeltaResponse {
  changes: DeltaChanges
  timestamp: string
}

export const deltaApi = {
  getChanges: async (since?: string): Promise<DeltaResponse> => {
    const params = since ? `?since=${since}` : ''
    const response = await api.get(`/delta/changes${params}`)
    return response.data
  },
}

