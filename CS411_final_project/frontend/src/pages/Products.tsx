import { useState, useEffect } from 'react'
import { productsApi, Product, ProductVersion } from '../api/products'
import ConflictResolutionBanner from '../components/ConflictResolutionBanner'
import VersionHistory from '../components/VersionHistory'
import './Products.css'

const Products = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versions, setVersions] = useState<ProductVersion[]>([])
  const [conflict, setConflict] = useState<any>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProduct, setNewProduct] = useState<Partial<Product>>({})

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [page, category, search])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await productsApi.getAll(page, 20, category || undefined, search || undefined)
      setProducts(response.products)
      setTotalPages(response.total_pages)
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const cats = await productsApi.getCategories()
      setCategories(cats)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const handleEdit = async (product: Product) => {
    try {
      const data = await productsApi.getById(product.product_id)
      setVersions(data.versions)
      setEditingProduct(data.product)
    } catch (error) {
      console.error('Failed to fetch product:', error)
    }
  }

  const handleSave = async (product: Product) => {
    try {
      const updated = await productsApi.update(product.product_id, {
        ...product,
        version: product.version || 1, // Include version for optimistic locking
        updated_by: 'seller',
      })
      setProducts(products.map(p => p.product_id === updated.product_id ? updated : p))
      setEditingProduct(null)
      setConflict(null)
    } catch (error: any) {
      if (error.response?.status === 409 && error.response.data.conflict) {
        setConflict(error.response.data)
        // Reload the product to get current version
        const data = await productsApi.getById(product.product_id)
        setEditingProduct(data.product)
        setVersions(data.versions)
      } else {
        console.error('Failed to update product:', error)
        alert('Failed to update product')
      }
    }
  }

  const handleCreate = async () => {
    try {
      const created = await productsApi.create({
        ...newProduct,
        created_by: 'seller',
      })
      setProducts([created, ...products])
      setShowCreateModal(false)
      setNewProduct({})
    } catch (error: any) {
      if (error.response?.status === 409) {
        alert('Product already exists')
      } else {
        console.error('Failed to create product:', error)
        const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred'
        alert(`Failed to create product: ${errorMessage}`)
      }
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    
    try {
      await productsApi.delete(productId)
      setProducts(products.filter(p => p.product_id !== productId))
    } catch (error) {
      console.error('Failed to delete product:', error)
      alert('Failed to delete product')
    }
  }

  const handleResolveConflict = async (useCurrent: boolean) => {
    if (!editingProduct || !conflict) return

    try {
      const updated = await productsApi.update(editingProduct.product_id, {
        ...(useCurrent ? conflict.current_values : editingProduct),
        version: conflict.current_version,
        updated_by: 'seller',
      })
      setProducts(products.map(p => p.product_id === updated.product_id ? updated : p))
      setEditingProduct(updated)
      setConflict(null)
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      alert('Failed to resolve conflict')
    }
  }

  return (
    <div className="products-page">
      <div className="page-header">
        <h1>Products</h1>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          + Add Product
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="search-input"
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1) }}
          className="category-select"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {conflict && editingProduct && (
        <ConflictResolutionBanner
          conflict={conflict}
          currentValues={conflict.current_values}
          submittedValues={editingProduct}
          onResolve={handleResolveConflict}
        />
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <div className="products-grid">
            {products.map(product => (
              <div key={product.product_id} className="product-card">
                <div className="product-header">
                  <h3>{product.title || 'Untitled Product'}</h3>
                  <div className="product-actions">
                    <button onClick={() => handleEdit(product)}>Edit</button>
                    <button onClick={() => handleDelete(product.product_id)} className="btn-danger">Delete</button>
                  </div>
                </div>
                <div className="product-info">
                  <p><strong>Category:</strong> {product.category_name || 'N/A'}</p>
                  <p><strong>Available:</strong> {product.available_qty || 0}</p>
                  <p><strong>Reserved:</strong> {product.reserved_qty || 0}</p>
                  {product.version && <p><strong>Version:</strong> {product.version}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next
            </button>
          </div>
        </>
      )}

      {editingProduct && (
        <div className="modal-overlay" onClick={() => { setEditingProduct(null); setConflict(null) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Product</h2>
              <button onClick={() => { setEditingProduct(null); setConflict(null) }}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={editingProduct.title || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={editingProduct.category_name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category_name: e.target.value })}
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Available Quantity</label>
                <input
                  type="number"
                  value={editingProduct.available_qty || 0}
                  onChange={(e) => setEditingProduct({ ...editingProduct, available_qty: parseInt(e.target.value) })}
                />
              </div>
              <div className="form-actions">
                <button onClick={() => setShowVersionHistory(!showVersionHistory)}>
                  {showVersionHistory ? 'Hide' : 'Show'} Version History
                </button>
                <button onClick={() => handleSave(editingProduct)} className="btn-primary">Save</button>
                <button onClick={() => { setEditingProduct(null); setConflict(null) }}>Cancel</button>
              </div>
              {showVersionHistory && (
                <VersionHistory versions={versions} />
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Product</h2>
              <button onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Product ID</label>
                <input
                  type="text"
                  value={newProduct.product_id || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, product_id: e.target.value })}
                  placeholder="Leave empty to auto-generate"
                />
              </div>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={newProduct.title || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newProduct.description || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={newProduct.category_name || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, category_name: e.target.value })}
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Available Quantity</label>
                <input
                  type="number"
                  value={newProduct.available_qty || 0}
                  onChange={(e) => setNewProduct({ ...newProduct, available_qty: parseInt(e.target.value) })}
                />
              </div>
              <div className="form-actions">
                <button onClick={handleCreate} className="btn-primary">Create</button>
                <button onClick={() => setShowCreateModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Products

