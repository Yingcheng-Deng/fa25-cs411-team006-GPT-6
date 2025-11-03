import api from './client'

export interface Product {
  product_id: string
  title: string
  description?: string
  weight_g?: number
  length_cm?: number
  height_cm?: number
  width_cm?: number
  category_name?: string
  photos_qty?: number
  version?: number
  updated_at?: string
  available_qty?: number
  reserved_qty?: number
  restock_date?: string
}

export interface ProductVersion {
  version_id: number
  product_id: string
  version: number
  title: string
  description?: string
  created_at: string
  created_by?: string
  change_summary?: string
}

export interface ProductsResponse {
  products: Product[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export const productsApi = {
  getAll: async (page = 1, limit = 20, category?: string, search?: string): Promise<ProductsResponse> => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() })
    if (category) params.append('category', category)
    if (search) params.append('search', search)
    
    const response = await api.get(`/products?${params}`)
    return response.data
  },

  getById: async (productId: string): Promise<{ product: Product; versions: ProductVersion[] }> => {
    const response = await api.get(`/products/${productId}`)
    return response.data
  },

  create: async (product: Partial<Product>): Promise<Product> => {
    const response = await api.post('/products', product)
    return response.data
  },

  update: async (productId: string, product: Partial<Product>): Promise<Product> => {
    const response = await api.put(`/products/${productId}`, product)
    return response.data
  },

  delete: async (productId: string): Promise<void> => {
    await api.delete(`/products/${productId}`)
  },

  getCategories: async (): Promise<string[]> => {
    const response = await api.get('/products/categories')
    return response.data
  },
}

