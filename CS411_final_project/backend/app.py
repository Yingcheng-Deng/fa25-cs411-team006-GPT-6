from flask import Flask, request, jsonify, g
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime
from functools import wraps
import hashlib
import os
import sys

app = Flask(__name__)
CORS(app)

# Look for database in parent directory (project root)
DATABASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'ultimate_ecommerce.db')

def get_db():
    """Get database connection"""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_db(exception):
    """Close database connection"""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_version_tracking():
    """Initialize version tracking tables for optimistic locking"""
    db = get_db()
    cursor = db.cursor()
    
    # Check if Products table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='Products'
    """)
    products_table_exists = cursor.fetchone() is not None
    
    # Check if Orders table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='Orders'
    """)
    orders_table_exists = cursor.fetchone() is not None
    
    # Product version history table (can be created independently)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Product_Versions (
            version_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id VARCHAR(255) NOT NULL,
            version INTEGER NOT NULL,
            title VARCHAR(255),
            description TEXT,
            weight_g DECIMAL(10,2),
            length_cm DECIMAL(10,2),
            height_cm DECIMAL(10,2),
            width_cm DECIMAL(10,2),
            category_name VARCHAR(100),
            photos_qty INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(255),
            change_summary TEXT,
            FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE
        )
    """)
    
    # Only alter Products table if it exists
    if products_table_exists:
        # Add version column to Products if not exists
        cursor.execute("PRAGMA table_info(Products)")
        columns = [col[1] for col in cursor.fetchall()]
        if 'version' not in columns:
            try:
                cursor.execute("ALTER TABLE Products ADD COLUMN version INTEGER DEFAULT 1")
            except sqlite3.OperationalError:
                pass  # Column might already exist
        
        # Add updated_at to Products if not exists
        if 'updated_at' not in columns:
            try:
                cursor.execute("ALTER TABLE Products ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            except sqlite3.OperationalError:
                pass  # Column might already exist
    
    # Only alter Orders table if it exists
    if orders_table_exists:
        # Add updated_at to Orders if not exists
        cursor.execute("PRAGMA table_info(Orders)")
        order_columns = [col[1] for col in cursor.fetchall()]
        if 'updated_at' not in order_columns:
            try:
                cursor.execute("ALTER TABLE Orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            except sqlite3.OperationalError:
                pass  # Column might already exist
    
    # Audit log table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Audit_Log (
            audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name VARCHAR(100) NOT NULL,
            record_id VARCHAR(255) NOT NULL,
            action VARCHAR(50) NOT NULL,
            old_values TEXT,
            new_values TEXT,
            changed_by VARCHAR(255),
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ip_address VARCHAR(50)
        )
    """)
    
    # Order status history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Order_Status_History (
            history_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id VARCHAR(255) NOT NULL,
            old_status VARCHAR(50),
            new_status VARCHAR(50),
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            changed_by VARCHAR(255),
            notes TEXT,
            FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE
        )
    """)
    
    db.commit()

# Initialize version tracking on startup (only if database exists)
with app.app_context():
    try:
        # Check if database file exists
        if os.path.exists(DATABASE):
            init_version_tracking()
            print(f"✓ Version tracking initialized (database: {DATABASE})")
        else:
            print(f"⚠ Warning: Database file not found: {DATABASE}")
            print("  Please run cs411_final_project.py first to create the database.")
    except Exception as e:
        print(f"⚠ Warning: Could not initialize version tracking: {e}")
        print("  The database may not exist yet. Please run cs411_final_project.py first.")

# ============================================================================
# PRODUCTS API
# ============================================================================

@app.route('/api/products', methods=['GET'])
def get_products():
    """Get all products with pagination and filters"""
    db = get_db()
    cursor = db.cursor()
    
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    category = request.args.get('category')
    search = request.args.get('search')
    
    offset = (page - 1) * limit
    
    query = """
        SELECT p.*, i.available_qty, i.reserved_qty, i.restock_date
        FROM Products p
        LEFT JOIN Inventory i ON p.product_id = i.product_id
        WHERE 1=1
    """
    params = []
    
    if category:
        query += " AND p.category_name = ?"
        params.append(category)
    
    if search:
        query += " AND (p.title LIKE ? OR p.description LIKE ?)"
        params.extend([f'%{search}%', f'%{search}%'])
    
    query += " ORDER BY p.updated_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    products = [dict(row) for row in cursor.fetchall()]
    
    # Get total count
    count_query = "SELECT COUNT(*) FROM Products p WHERE 1=1"
    count_params = []
    if category:
        count_query += " AND p.category_name = ?"
        count_params.append(category)
    if search:
        count_query += " AND (p.title LIKE ? OR p.description LIKE ?)"
        count_params.extend([f'%{search}%', f'%{search}%'])
    
    cursor.execute(count_query, count_params)
    total = cursor.fetchone()[0]
    
    return jsonify({
        'products': products,
        'total': total,
        'page': page,
        'limit': limit,
        'total_pages': (total + limit - 1) // limit
    })

@app.route('/api/products/<product_id>', methods=['GET'])
def get_product(product_id):
    """Get single product with version history"""
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute("""
        SELECT p.*, i.available_qty, i.reserved_qty, i.restock_date
        FROM Products p
        LEFT JOIN Inventory i ON p.product_id = i.product_id
        WHERE p.product_id = ?
    """, (product_id,))
    
    product = cursor.fetchone()
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    
    # Get version history
    cursor.execute("""
        SELECT * FROM Product_Versions
        WHERE product_id = ?
        ORDER BY version DESC
        LIMIT 10
    """, (product_id,))
    
    versions = [dict(row) for row in cursor.fetchall()]
    
    return jsonify({
        'product': dict(product),
        'versions': versions
    })

@app.route('/api/products', methods=['POST'])
def create_product():
    """Create new product (idempotent)"""
    db = get_db()
    cursor = db.cursor()
    data = request.json
    
    # Check if product already exists (idempotency)
    product_id = data.get('product_id')
    if product_id:
        cursor.execute("SELECT product_id FROM Products WHERE product_id = ?", (product_id,))
        if cursor.fetchone():
            return jsonify({'error': 'Product already exists', 'product_id': product_id}), 409
    
    # Generate product_id if not provided
    if not product_id:
        product_id = hashlib.md5(f"{data.get('title', '')}{datetime.now().isoformat()}".encode()).hexdigest()[:32]
    
    try:
        cursor.execute("""
            INSERT INTO Products 
            (product_id, title, description, weight_g, length_cm, height_cm, width_cm, 
             category_name, photos_qty, version, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        """, (
            product_id,
            data.get('title', ''),
            data.get('description'),
            data.get('weight_g'),
            data.get('length_cm'),
            data.get('height_cm'),
            data.get('width_cm'),
            data.get('category_name'),
            data.get('photos_qty', 0)
        ))
        
        # Create initial inventory
        cursor.execute("""
            INSERT INTO Inventory (product_id, available_qty, reserved_qty)
            VALUES (?, ?, 0)
        """, (product_id, data.get('available_qty', 0)))
        
        # Create initial version history
        cursor.execute("""
            INSERT INTO Product_Versions 
            (product_id, version, title, description, weight_g, length_cm, height_cm, 
             width_cm, category_name, photos_qty, created_by, change_summary)
            VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            product_id, data.get('title', ''), data.get('description'),
            data.get('weight_g'), data.get('length_cm'), data.get('height_cm'),
            data.get('width_cm'), data.get('category_name'), data.get('photos_qty', 0),
            data.get('created_by', 'system'), 'Initial creation'
        ))
        
        # Audit log
        cursor.execute("""
            INSERT INTO Audit_Log (table_name, record_id, action, new_values, changed_by)
            VALUES ('Products', ?, 'CREATE', ?, ?)
        """, (product_id, json.dumps(data), data.get('created_by', 'system')))
        
        db.commit()
        
        cursor.execute("""
            SELECT p.*, i.available_qty, i.reserved_qty, i.restock_date
            FROM Products p
            LEFT JOIN Inventory i ON p.product_id = i.product_id
            WHERE p.product_id = ?
        """, (product_id,))
        
        return jsonify(dict(cursor.fetchone())), 201
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/products/<product_id>', methods=['PUT'])
def update_product(product_id):
    """Update product with optimistic locking"""
    db = get_db()
    cursor = db.cursor()
    data = request.json
    
    # Get current version
    cursor.execute("SELECT version, * FROM Products WHERE product_id = ?", (product_id,))
    current = cursor.fetchone()
    if not current:
        return jsonify({'error': 'Product not found'}), 404
    
    current_version = current['version']
    expected_version = data.get('version')
    
    # Optimistic locking check
    if expected_version and current_version != expected_version:
        # Get current values for conflict resolution
        cursor.execute("SELECT * FROM Products WHERE product_id = ?", (product_id,))
        current_values = dict(cursor.fetchone())
        
        return jsonify({
            'error': 'Version conflict',
            'conflict': True,
            'current_version': current_version,
            'expected_version': expected_version,
            'current_values': current_values,
            'submitted_values': data
        }), 409
    
    try:
        # Get old values for audit
        old_values = dict(current)
        
        # Increment version
        new_version = current_version + 1
        
        # Update product
        cursor.execute("""
            UPDATE Products SET
                title = ?, description = ?, weight_g = ?, length_cm = ?,
                height_cm = ?, width_cm = ?, category_name = ?,
                photos_qty = ?, version = ?, updated_at = CURRENT_TIMESTAMP
            WHERE product_id = ?
        """, (
            data.get('title', current['title']),
            data.get('description', current['description']),
            data.get('weight_g', current['weight_g']),
            data.get('length_cm', current['length_cm']),
            data.get('height_cm', current['height_cm']),
            data.get('width_cm', current['width_cm']),
            data.get('category_name', current['category_name']),
            data.get('photos_qty', current['photos_qty']),
            new_version,
            product_id
        ))
        
        # Update inventory if provided
        if 'available_qty' in data:
            cursor.execute("""
                UPDATE Inventory SET available_qty = ?
                WHERE product_id = ?
            """, (data['available_qty'], product_id))
        
        # Create version history entry
        cursor.execute("""
            INSERT INTO Product_Versions 
            (product_id, version, title, description, weight_g, length_cm, height_cm,
             width_cm, category_name, photos_qty, created_by, change_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            product_id, new_version,
            data.get('title', current['title']),
            data.get('description', current['description']),
            data.get('weight_g', current['weight_g']),
            data.get('length_cm', current['length_cm']),
            data.get('height_cm', current['height_cm']),
            data.get('width_cm', current['width_cm']),
            data.get('category_name', current['category_name']),
            data.get('photos_qty', current['photos_qty']),
            data.get('updated_by', 'system'),
            data.get('change_summary', 'Product updated')
        ))
        
        # Audit log
        cursor.execute("""
            INSERT INTO Audit_Log (table_name, record_id, action, old_values, new_values, changed_by)
            VALUES ('Products', ?, 'UPDATE', ?, ?, ?)
        """, (product_id, json.dumps(old_values), json.dumps(data), data.get('updated_by', 'system')))
        
        db.commit()
        
        # Return updated product
        cursor.execute("""
            SELECT p.*, i.available_qty, i.reserved_qty, i.restock_date
            FROM Products p
            LEFT JOIN Inventory i ON p.product_id = i.product_id
            WHERE p.product_id = ?
        """, (product_id,))
        
        return jsonify(dict(cursor.fetchone()))
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/products/<product_id>', methods=['DELETE'])
def delete_product(product_id):
    """Delete product"""
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute("SELECT * FROM Products WHERE product_id = ?", (product_id,))
    product = cursor.fetchone()
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    
    try:
        # Audit log
        cursor.execute("""
            INSERT INTO Audit_Log (table_name, record_id, action, old_values, changed_by)
            VALUES ('Products', ?, 'DELETE', ?, ?)
        """, (product_id, json.dumps(dict(product)), request.json.get('deleted_by', 'system')))
        
        cursor.execute("DELETE FROM Products WHERE product_id = ?", (product_id,))
        db.commit()
        
        return jsonify({'message': 'Product deleted successfully'})
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/products/categories', methods=['GET'])
def get_categories():
    """Get all product categories"""
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute("SELECT DISTINCT category_name FROM Products WHERE category_name IS NOT NULL ORDER BY category_name")
    categories = [row[0] for row in cursor.fetchall()]
    
    return jsonify(categories)

# ============================================================================
# ORDERS API
# ============================================================================

@app.route('/api/orders', methods=['GET'])
def get_orders():
    """Get all orders with filters"""
    db = get_db()
    cursor = db.cursor()
    
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    status = request.args.get('status')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    customer_id = request.args.get('customer_id')
    
    offset = (page - 1) * limit
    
    query = """
        SELECT o.*, c.name as customer_name, c.email as customer_email,
               COUNT(DISTINCT oi.order_item_id) as item_count,
               SUM(oi.quantity * oi.unit_price + oi.freight_value) as total_amount
        FROM Orders o
        LEFT JOIN Customers c ON o.customer_id = c.customer_id
        LEFT JOIN Order_Items oi ON o.order_id = oi.order_id
        WHERE 1=1
    """
    params = []
    
    if status:
        query += " AND o.status = ?"
        params.append(status)
    
    if date_from:
        query += " AND DATE(o.purchase_ts) >= ?"
        params.append(date_from)
    
    if date_to:
        query += " AND DATE(o.purchase_ts) <= ?"
        params.append(date_to)
    
    if customer_id:
        query += " AND o.customer_id = ?"
        params.append(customer_id)
    
    query += " GROUP BY o.order_id ORDER BY o.purchase_ts DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    orders = [dict(row) for row in cursor.fetchall()]
    
    # Get total count
    count_query = "SELECT COUNT(DISTINCT o.order_id) FROM Orders o WHERE 1=1"
    count_params = []
    if status:
        count_query += " AND o.status = ?"
        count_params.append(status)
    if date_from:
        count_query += " AND DATE(o.purchase_ts) >= ?"
        count_params.append(date_from)
    if date_to:
        count_query += " AND DATE(o.purchase_ts) <= ?"
        count_params.append(date_to)
    if customer_id:
        count_query += " AND o.customer_id = ?"
        count_params.append(customer_id)
    
    cursor.execute(count_query, count_params)
    total = cursor.fetchone()[0]
    
    return jsonify({
        'orders': orders,
        'total': total,
        'page': page,
        'limit': limit,
        'total_pages': (total + limit - 1) // limit
    })

@app.route('/api/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    """Get single order with items"""
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute("""
        SELECT o.*, c.name as customer_name, c.email as customer_email,
               c.phone as customer_phone, c.city, c.state
        FROM Orders o
        LEFT JOIN Customers c ON o.customer_id = c.customer_id
        WHERE o.order_id = ?
    """, (order_id,))
    
    order = cursor.fetchone()
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    
    # Get order items
    cursor.execute("""
        SELECT oi.*, p.title as product_title, p.category_name,
               i.available_qty
        FROM Order_Items oi
        LEFT JOIN Products p ON oi.product_id = p.product_id
        LEFT JOIN Inventory i ON oi.product_id = i.product_id
        WHERE oi.order_id = ?
    """, (order_id,))
    
    items = [dict(row) for row in cursor.fetchall()]
    
    # Get payments
    cursor.execute("SELECT * FROM Payments WHERE order_id = ?", (order_id,))
    payments = [dict(row) for row in cursor.fetchall()]
    
    # Get status history
    cursor.execute("""
        SELECT * FROM Order_Status_History
        WHERE order_id = ?
        ORDER BY changed_at DESC
    """, (order_id,))
    
    status_history = [dict(row) for row in cursor.fetchall()]
    
    return jsonify({
        'order': dict(order),
        'items': items,
        'payments': payments,
        'status_history': status_history
    })

@app.route('/api/orders/<order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    """Update order status with history tracking"""
    db = get_db()
    cursor = db.cursor()
    data = request.json
    
    cursor.execute("SELECT status FROM Orders WHERE order_id = ?", (order_id,))
    result = cursor.fetchone()
    if not result:
        return jsonify({'error': 'Order not found'}), 404
    
    old_status = result['status']
    new_status = data.get('status')
    
    if not new_status:
        return jsonify({'error': 'Status required'}), 400
    
    # Valid status transitions
    valid_statuses = ['pending', 'processing', 'shipped', 'delivered', 'canceled', 'refunded']
    if new_status not in valid_statuses:
        return jsonify({'error': 'Invalid status'}), 400
    
    try:
        # Update order status
        status_fields = {
            'processing': 'approved_at',
            'shipped': 'delivered_carrier_date',
            'delivered': 'delivered_customer_date'
        }
        
        update_query = "UPDATE Orders SET status = ?, updated_at = CURRENT_TIMESTAMP"
        params = [new_status]
        
        if new_status in status_fields:
            update_query += f", {status_fields[new_status]} = CURRENT_TIMESTAMP"
        
        update_query += " WHERE order_id = ?"
        params.append(order_id)
        
        cursor.execute(update_query, params)
        
        # Record status history
        cursor.execute("""
            INSERT INTO Order_Status_History 
            (order_id, old_status, new_status, changed_by, notes)
            VALUES (?, ?, ?, ?, ?)
        """, (order_id, old_status, new_status, data.get('changed_by', 'system'), data.get('notes')))
        
        # Audit log
        cursor.execute("""
            INSERT INTO Audit_Log (table_name, record_id, action, old_values, new_values, changed_by)
            VALUES ('Orders', ?, 'STATUS_UPDATE', ?, ?, ?)
        """, (order_id, json.dumps({'status': old_status}), json.dumps({'status': new_status}), 
              data.get('changed_by', 'system')))
        
        db.commit()
        
        # Return updated order
        cursor.execute("SELECT * FROM Orders WHERE order_id = ?", (order_id,))
        return jsonify(dict(cursor.fetchone()))
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/orders/<order_id>/items/<item_id>', methods=['PUT'])
def update_order_item(order_id, item_id):
    """Update order item"""
    db = get_db()
    cursor = db.cursor()
    data = request.json
    
    cursor.execute("SELECT * FROM Order_Items WHERE order_item_id = ? AND order_id = ?", (item_id, order_id))
    item = cursor.fetchone()
    if not item:
        return jsonify({'error': 'Order item not found'}), 404
    
    try:
        cursor.execute("""
            UPDATE Order_Items SET
                quantity = ?, unit_price = ?, freight_value = ?
            WHERE order_item_id = ? AND order_id = ?
        """, (
            data.get('quantity', item['quantity']),
            data.get('unit_price', item['unit_price']),
            data.get('freight_value', item['freight_value']),
            item_id, order_id
        ))
        
        # Audit log
        cursor.execute("""
            INSERT INTO Audit_Log (table_name, record_id, action, old_values, new_values, changed_by)
            VALUES ('Order_Items', ?, 'UPDATE', ?, ?, ?)
        """, (item_id, json.dumps(dict(item)), json.dumps(data), data.get('updated_by', 'system')))
        
        db.commit()
        
        cursor.execute("SELECT * FROM Order_Items WHERE order_item_id = ?", (item_id,))
        return jsonify(dict(cursor.fetchone()))
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/orders/<order_id>/cancel', methods=['POST'])
def cancel_order(order_id):
    """Cancel order and update inventory"""
    db = get_db()
    cursor = db.cursor()
    data = request.json
    
    cursor.execute("SELECT status FROM Orders WHERE order_id = ?", (order_id,))
    result = cursor.fetchone()
    if not result:
        return jsonify({'error': 'Order not found'}), 404
    
    if result['status'] in ['delivered', 'canceled', 'refunded']:
        return jsonify({'error': f'Cannot cancel order with status: {result["status"]}'}), 400
    
    try:
        # Get order items and restore inventory
        cursor.execute("SELECT product_id, quantity FROM Order_Items WHERE order_id = ?", (order_id,))
        items = cursor.fetchall()
        
        for item in items:
            cursor.execute("""
                UPDATE Inventory 
                SET available_qty = available_qty + ?, reserved_qty = reserved_qty - ?
                WHERE product_id = ?
            """, (item['quantity'], item['quantity'], item['product_id']))
        
        # Update order status
        cursor.execute("UPDATE Orders SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?", (order_id,))
        
        # Record status history
        cursor.execute("""
            INSERT INTO Order_Status_History 
            (order_id, old_status, new_status, changed_by, notes)
            VALUES (?, ?, 'canceled', ?, ?)
        """, (order_id, result['status'], data.get('changed_by', 'system'), data.get('notes', 'Order canceled')))
        
        db.commit()
        
        return jsonify({'message': 'Order canceled successfully'})
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/orders/<order_id>/refund', methods=['POST'])
def refund_order(order_id):
    """Refund order"""
    db = get_db()
    cursor = db.cursor()
    data = request.json
    
    cursor.execute("SELECT status FROM Orders WHERE order_id = ?", (order_id,))
    result = cursor.fetchone()
    if not result:
        return jsonify({'error': 'Order not found'}), 404
    
    try:
        # Update order status
        cursor.execute("UPDATE Orders SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?", (order_id,))
        
        # Record status history
        cursor.execute("""
            INSERT INTO Order_Status_History 
            (order_id, old_status, new_status, changed_by, notes)
            VALUES (?, ?, 'refunded', ?, ?)
        """, (order_id, result['status'], data.get('changed_by', 'system'), data.get('notes', 'Order refunded')))
        
        # Audit log
        cursor.execute("""
            INSERT INTO Audit_Log (table_name, record_id, action, old_values, new_values, changed_by)
            VALUES ('Orders', ?, 'REFUND', ?, ?, ?)
        """, (order_id, json.dumps({'status': result['status']}), json.dumps({'status': 'refunded'}), 
              data.get('changed_by', 'system')))
        
        db.commit()
        
        return jsonify({'message': 'Order refunded successfully'})
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400

# ============================================================================
# REPORTS API
# ============================================================================

@app.route('/api/reports/sales-trends', methods=['GET'])
def get_sales_trends():
    """Get sales trends over time"""
    db = get_db()
    cursor = db.cursor()
    
    days = int(request.args.get('days', 30))
    
    cursor.execute("""
        SELECT 
            DATE(o.purchase_ts) as date,
            COUNT(DISTINCT o.order_id) as order_count,
            SUM(oi.quantity * oi.unit_price + oi.freight_value) as revenue,
            SUM(oi.quantity) as units_sold
        FROM Orders o
        INNER JOIN Order_Items oi ON o.order_id = oi.order_id
        WHERE o.status != 'canceled'
          AND o.purchase_ts >= date('now', '-' || ? || ' days')
        GROUP BY DATE(o.purchase_ts)
        ORDER BY date
    """, (days,))
    
    trends = [dict(row) for row in cursor.fetchall()]
    
    return jsonify(trends)

@app.route('/api/reports/category-distribution', methods=['GET'])
def get_category_distribution():
    """Get sales by category"""
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute("""
        SELECT 
            p.category_name,
            COUNT(DISTINCT o.order_id) as order_count,
            SUM(oi.quantity) as units_sold,
            SUM(oi.quantity * oi.unit_price) as revenue
        FROM Products p
        INNER JOIN Order_Items oi ON p.product_id = oi.product_id
        INNER JOIN Orders o ON oi.order_id = o.order_id
        WHERE o.status != 'canceled'
          AND p.category_name IS NOT NULL
        GROUP BY p.category_name
        ORDER BY revenue DESC
        LIMIT 20
    """)
    
    distribution = [dict(row) for row in cursor.fetchall()]
    
    return jsonify(distribution)

@app.route('/api/reports/top-products', methods=['GET'])
def get_top_products():
    """Get top selling products"""
    db = get_db()
    cursor = db.cursor()
    
    limit = int(request.args.get('limit', 10))
    days = int(request.args.get('days', 30))
    
    cursor.execute("""
        SELECT 
            p.product_id,
            p.title,
            p.category_name,
            COUNT(DISTINCT o.order_id) as order_count,
            SUM(oi.quantity) as units_sold,
            SUM(oi.quantity * oi.unit_price) as revenue,
            AVG(oi.unit_price) as avg_price
        FROM Products p
        INNER JOIN Order_Items oi ON p.product_id = oi.product_id
        INNER JOIN Orders o ON oi.order_id = o.order_id
        WHERE o.status != 'canceled'
          AND o.purchase_ts >= date('now', '-' || ? || ' days')
        GROUP BY p.product_id, p.title, p.category_name
        ORDER BY revenue DESC
        LIMIT ?
    """, (days, limit))
    
    products = [dict(row) for row in cursor.fetchall()]
    
    return jsonify(products)

@app.route('/api/reports/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    """Get dashboard statistics"""
    db = get_db()
    cursor = db.cursor()
    
    # Total revenue
    cursor.execute("""
        SELECT SUM(oi.quantity * oi.unit_price + oi.freight_value) as total_revenue
        FROM Orders o
        INNER JOIN Order_Items oi ON o.order_id = oi.order_id
        WHERE o.status != 'canceled'
          AND DATE(o.purchase_ts) = DATE('now')
    """)
    today_revenue = cursor.fetchone()[0] or 0
    
    # Total orders
    cursor.execute("""
        SELECT COUNT(*) as order_count
        FROM Orders
        WHERE DATE(purchase_ts) = DATE('now')
    """)
    today_orders = cursor.fetchone()[0] or 0
    
    # Pending orders
    cursor.execute("SELECT COUNT(*) FROM Orders WHERE status IN ('pending', 'processing')")
    pending_orders = cursor.fetchone()[0] or 0
    
    # Low stock items
    cursor.execute("""
        SELECT COUNT(*) FROM Inventory
        WHERE available_qty < 20
    """)
    low_stock = cursor.fetchone()[0] or 0
    
    return jsonify({
        'today_revenue': today_revenue,
        'today_orders': today_orders,
        'pending_orders': pending_orders,
        'low_stock': low_stock
    })

# ============================================================================
# DELTA POLLING API
# ============================================================================

@app.route('/api/delta/changes', methods=['GET'])
def get_changes():
    """Get changes since last poll (delta polling)"""
    db = get_db()
    cursor = db.cursor()
    
    since = request.args.get('since')
    if not since:
        since = datetime.now().isoformat()
    
    changes = {}
    
    # Get changed products
    cursor.execute("""
        SELECT product_id, updated_at FROM Products
        WHERE updated_at > ?
        ORDER BY updated_at DESC
        LIMIT 50
    """, (since,))
    changes['products'] = [dict(row) for row in cursor.fetchall()]
    
    # Get changed orders
    cursor.execute("""
        SELECT o.order_id, o.updated_at, o.status
        FROM Orders o
        WHERE o.purchase_ts > ? OR EXISTS (
            SELECT 1 FROM Order_Status_History osh
            WHERE osh.order_id = o.order_id AND osh.changed_at > ?
        )
        ORDER BY o.purchase_ts DESC
        LIMIT 50
    """, (since, since))
    changes['orders'] = [dict(row) for row in cursor.fetchall()]
    
    # Get new audit entries
    cursor.execute("""
        SELECT * FROM Audit_Log
        WHERE changed_at > ?
        ORDER BY changed_at DESC
        LIMIT 50
    """, (since,))
    changes['audit'] = [dict(row) for row in cursor.fetchall()]
    
    return jsonify({
        'changes': changes,
        'timestamp': datetime.now().isoformat()
    })

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    app.run(debug=True, port=5000)

