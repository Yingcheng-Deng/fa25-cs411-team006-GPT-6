import { useState, useEffect } from 'react'
import { ordersApi, Order, OrderDetail, OrderItem } from '../api/orders'
import './Orders.css'

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'canceled', 'refunded']

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    customerId: '',
  })

  useEffect(() => {
    fetchOrders()
  }, [page, filters])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const response = await ordersApi.getAll(
        page,
        20,
        filters.status || undefined,
        filters.dateFrom || undefined,
        filters.dateTo || undefined,
        filters.customerId || undefined
      )
      setOrders(response.orders)
      setTotalPages(response.total_pages)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrderDetail = async (orderId: string) => {
    try {
      const detail = await ordersApi.getById(orderId)
      setSelectedOrder(detail)
    } catch (error: any) {
      console.error('Failed to fetch order detail:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch order details'
      alert(`Failed to fetch order details: ${errorMessage}`)
      // Clear selected order on error
      setSelectedOrder(null)
    }
  }

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await ordersApi.updateStatus(orderId, newStatus)
      // Refresh the order list
      await fetchOrders()
      // Refresh the selected order detail if it's the one we updated
      if (selectedOrder && selectedOrder.order_id === orderId) {
        await fetchOrderDetail(orderId)
      }
    } catch (error: any) {
      console.error('Failed to update order status:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update order status'
      alert(`Failed to update order status: ${errorMessage}`)
    }
  }

  const handleItemUpdate = async (orderId: string, itemId: number, updates: Partial<OrderItem>) => {
    try {
      await ordersApi.updateItem(orderId, itemId, updates)
      if (selectedOrder) {
        await fetchOrderDetail(orderId)
      }
    } catch (error) {
      console.error('Failed to update order item:', error)
      alert('Failed to update order item')
    }
  }

  const handleCancel = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return
    
    try {
      await ordersApi.cancel(orderId)
      await fetchOrders()
      if (selectedOrder && selectedOrder.order_id === orderId) {
        setSelectedOrder(null)
      }
    } catch (error: any) {
      console.error('Failed to cancel order:', error)
      alert(error.response?.data?.error || 'Failed to cancel order')
    }
  }

  const handleRefund = async (orderId: string) => {
    if (!confirm('Are you sure you want to refund this order?')) return
    
    try {
      await ordersApi.refund(orderId)
      await fetchOrders()
      if (selectedOrder && selectedOrder.order_id === orderId) {
        await fetchOrderDetail(orderId)
      }
    } catch (error) {
      console.error('Failed to refund order:', error)
      alert('Failed to refund order')
    }
  }

  const getStatusIndex = (status: string) => {
    return ORDER_STATUSES.indexOf(status)
  }

  const canTransitionTo = (currentStatus: string, targetStatus: string) => {
    const currentIdx = getStatusIndex(currentStatus)
    const targetIdx = getStatusIndex(targetStatus)
    
    if (currentStatus === 'canceled' || currentStatus === 'refunded') return false
    if (targetStatus === 'canceled' || targetStatus === 'refunded') return true
    
    return targetIdx === currentIdx + 1 || targetIdx === currentIdx - 1
  }

  return (
    <div className="orders-page">
      <h1>Orders</h1>

      <div className="filters">
        <select
          value={filters.status}
          onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1) }}
          className="filter-select"
        >
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map(status => (
            <option key={status} value={status}>{status.toUpperCase()}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setPage(1) }}
          placeholder="From Date"
          className="filter-input"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value }); setPage(1) }}
          placeholder="To Date"
          className="filter-input"
        />
        <input
          type="text"
          value={filters.customerId}
          onChange={(e) => { setFilters({ ...filters, customerId: e.target.value }); setPage(1) }}
          placeholder="Customer ID"
          className="filter-input"
        />
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <div className="orders-list">
            {orders.map(order => (
              <div
                key={order.order_id}
                className={`order-card ${selectedOrder?.order_id === order.order_id ? 'selected' : ''}`}
                onClick={() => fetchOrderDetail(order.order_id)}
              >
                <div className="order-header">
                  <div>
                    <h3>Order #{order.order_id.slice(0, 8)}</h3>
                    <p className="order-date">
                      {order.purchase_ts 
                        ? new Date(order.purchase_ts).toLocaleDateString() 
                        : 'N/A'}
                    </p>
                  </div>
                  <span className={`status-badge status-${order.status}`}>
                    {order.status}
                  </span>
                </div>
                <div className="order-info">
                  <p><strong>Customer:</strong> {order.customer_name || order.customer_id}</p>
                  <p><strong>Items:</strong> {order.item_count || 0}</p>
                  <p><strong>Total:</strong> ${order.total_amount?.toFixed(2) || '0.00'}</p>
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

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content order-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Order Details</h2>
              <button onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="order-detail-section">
                <h3>Order Information</h3>
                <div className="detail-grid">
                  <div><strong>Order ID:</strong> {selectedOrder.order_id}</div>
                  <div><strong>Status:</strong> {selectedOrder.status}</div>
                  <div><strong>Customer:</strong> {selectedOrder.customer_name || selectedOrder.customer_id}</div>
                  <div><strong>Email:</strong> {selectedOrder.customer_email || 'N/A'}</div>
                  <div><strong>Purchase Date:</strong> {
                    selectedOrder.purchase_ts 
                      ? new Date(selectedOrder.purchase_ts).toLocaleString() 
                      : 'N/A'
                  }</div>
                </div>
              </div>

              <div className="order-detail-section">
                <h3>Status Stepper</h3>
                <div className="status-stepper">
                  {ORDER_STATUSES.map((status, idx) => {
                    const isActive = selectedOrder.status === status
                    const isCompleted = getStatusIndex(selectedOrder.status) > idx
                    const canTransition = canTransitionTo(selectedOrder.status, status)
                    
                    return (
                      <div key={status} className={`stepper-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                        <div className="stepper-circle">
                          {isCompleted ? '✓' : idx + 1}
                        </div>
                        <div className="stepper-content">
                          <div className="stepper-label">{status.toUpperCase()}</div>
                          {canTransition && !isActive && (
                            <button
                              className="stepper-action"
                              onClick={() => handleStatusChange(selectedOrder.order_id, status)}
                            >
                              Set to {status}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="order-detail-section">
                <h3>Order Items</h3>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map(item => (
                      <tr key={item.order_item_id}>
                        <td>{item.product_title || item.product_id}</td>
                        <td>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemUpdate(
                              selectedOrder.order_id,
                              item.order_item_id,
                              { quantity: parseInt(e.target.value) }
                            )}
                            min="1"
                            style={{ width: '60px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleItemUpdate(
                              selectedOrder.order_id,
                              item.order_item_id,
                              { unit_price: parseFloat(e.target.value) }
                            )}
                            step="0.01"
                            style={{ width: '80px' }}
                          />
                        </td>
                        <td>${(item.quantity * item.unit_price).toFixed(2)}</td>
                        <td>
                          <button
                            className="btn-small"
                            onClick={() => handleItemUpdate(
                              selectedOrder.order_id,
                              item.order_item_id,
                              { quantity: item.quantity, unit_price: item.unit_price }
                            )}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                          No items found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="order-detail-section">
                <h3>Actions</h3>
                <div className="action-buttons">
                  {selectedOrder.status !== 'canceled' && selectedOrder.status !== 'refunded' && (
                    <button
                      className="btn-danger"
                      onClick={() => handleCancel(selectedOrder.order_id)}
                    >
                      Cancel Order
                    </button>
                  )}
                  {selectedOrder.status === 'delivered' && (
                    <button
                      className="btn-warning"
                      onClick={() => handleRefund(selectedOrder.order_id)}
                    >
                      Refund Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Orders

