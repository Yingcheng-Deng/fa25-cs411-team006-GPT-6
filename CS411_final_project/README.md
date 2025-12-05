# Ultimate E-commerce Seller Dashboard

A React + TypeScript seller dashboard with Flask backend for managing products, orders, and reports with optimistic locking, version history, and real-time updates.

## Features

### Frontend (React + TypeScript)
- **Dashboard**: Real-time statistics with auto-refresh
- **Products**: 
  - Full CRUD operations
  - Version history tracking
  - Optimistic locking with conflict resolution banner
  - Diff view for conflicts
  - Guarded edits
- **Orders**:
  - Status stepper with visual progression
  - Filtering by status, date, customer
  - Item quantity and price editing
  - Cancel and refund functionality
- **Reports**:
  - Sales trends over time
  - Category distribution charts
  - Top products analysis
  - CSV export for all reports
  - Accessible charts (Recharts)
- **Real-time Updates**:
  - Delta polling every 5 seconds
  - Automatic refresh on changes
- **UI/UX**:
  - Clean minimal styling
  - Responsive layout
  - Collapsible sidebar
  - Idempotent POST requests

### Backend (Flask + SQLite)
- **RESTful API** with CORS support
- **Optimistic Locking**: Version tracking for products
- **Version History**: Complete audit trail
- **Audit Logging**: All changes tracked
- **Inventory Consistency**: Atomic updates
- **Delta Polling Endpoint**: Efficient change detection

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install Python dependencies:
   (You might need to install libraries like pandas, matplotlib, and kagglehub manually)
```bash
pip install -r requirements.txt
```

3. Ensure the database file exists:
   - The script expects `ultimate_ecommerce.db` in the project root
   - Run `cs411_final_project.py` first to create and populate the database

4. Start the Flask server:
```bash
python app.py
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install Node.js dependencies(Google) then run locally:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Products
- `GET /api/products` - List products with pagination and filters
- `GET /api/products/<id>` - Get product with version history
- `POST /api/products` - Create product (idempotent)
- `PUT /api/products/<id>` - Update product (optimistic locking)
- `DELETE /api/products/<id>` - Delete product
- `GET /api/products/categories` - Get all categories

### Orders
- `GET /api/orders` - List orders with filters
- `GET /api/orders/<id>` - Get order with items and history
- `PUT /api/orders/<id>/status` - Update order status
- `PUT /api/orders/<id>/items/<item_id>` - Update order item
- `POST /api/orders/<id>/cancel` - Cancel order
- `POST /api/orders/<id>/refund` - Refund order

### Reports
- `GET /api/reports/sales-trends` - Sales trends over time
- `GET /api/reports/category-distribution` - Sales by category
- `GET /api/reports/top-products` - Top selling products
- `GET /api/reports/dashboard-stats` - Dashboard statistics

### Delta Polling
- `GET /api/delta/changes?since=<timestamp>` - Get changes since timestamp

## Database Schema

The application uses the following main tables:
- `Products` - Product information with version tracking
- `Inventory` - Stock levels
- `Orders` - Order information
- `Order_Items` - Order line items
- `Customers` - Customer information
- `Payments` - Payment records
- `Reviews` - Product reviews
- `Product_Versions` - Version history for products
- `Order_Status_History` - Status change history
- `Audit_Log` - Complete audit trail

## Key Features Explained

### Optimistic Locking
Products have a `version` field that increments on each update. When updating, the client sends the expected version. If the server version differs, a 409 conflict is returned with both versions for resolution.

### Conflict Resolution
When a conflict is detected, the UI shows:
- A warning banner
- Current vs. submitted values
- Options to use current values or overwrite

### Version History
All product changes are stored in `Product_Versions` table, allowing:
- Viewing change history
- Tracking who made changes
- Change summaries

### Delta Polling
The frontend polls `/api/delta/changes` every 5 seconds to detect:
- Changed products
- Changed orders
- New audit entries

This enables real-time updates without full page refreshes.

## Development

### Project Structure
```
backend/
  app.py              # Flask API server
  requirements.txt    # Python dependencies

frontend/
  src/
    api/              # API client functions
    components/       # Reusable components
    hooks/            # Custom React hooks
    pages/            # Page components
    App.tsx           # Main app component
    main.tsx          # Entry point
```

### Testing
1. Start backend: `cd backend && python app.py`
2. Start frontend: `cd frontend && npm run dev`
3. Open browser to `http://localhost:3000`

## Notes

- The database must be created and populated before running the application
- CORS is enabled for local development
- All timestamps are in ISO format
- CSV exports include proper escaping for special characters

