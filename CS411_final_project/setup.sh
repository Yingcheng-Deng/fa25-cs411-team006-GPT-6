#!/bin/bash

echo "Setting up Ultimate E-commerce Seller Dashboard..."
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not installed."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required but not installed."
    exit 1
fi

echo "✓ Python 3 found"
echo "✓ Node.js found"
echo ""

# Setup backend
echo "Setting up backend..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
cd ..
echo "✓ Backend dependencies installed"
echo ""

# Setup frontend
echo "Setting up frontend..."
cd frontend
npm install
cd ..
echo "✓ Frontend dependencies installed"
echo ""

echo "Setup complete!"
echo ""
echo "To start the application:"
echo "  1. Make sure ultimate_ecommerce.db exists in the project root"
echo "  2. Backend: cd backend && source venv/bin/activate && python app.py"
echo "  3. Frontend: cd frontend && npm run dev"
echo ""
echo "Backend will run on http://localhost:5000"
echo "Frontend will run on http://localhost:3000"

