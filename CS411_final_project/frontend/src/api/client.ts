import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Remove Content-Type header for DELETE requests without body
api.interceptors.request.use((config) => {
  if (config.method === 'delete' && !config.data) {
    delete config.headers['Content-Type']
  }
  return config
})

export default api

