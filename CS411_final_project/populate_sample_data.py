#!/usr/bin/env python3
"""Populate database with sample data for testing the seller dashboard"""
import sqlite3
import random
from datetime import datetime, timedelta

DB_NAME = "ultimate_ecommerce.db"

def populate_sample_data():
    """Populate database with sample products, customers, orders, etc."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Creating sample data for Ultimate E-commerce Dashboard...")
    
    # Create schema if it doesn't exist
    from cs411_final_project import create_database_schema, create_indexes
    create_database_schema(conn)
    create_indexes(conn)
    
    # Add version and updated_at columns if they don't exist
    try:
        cursor.execute("PRAGMA table_info(Products)")
        columns = [col[1] for col in cursor.fetchall()]
        if 'version' not in columns:
            cursor.execute("ALTER TABLE Products ADD COLUMN version INTEGER DEFAULT 1")
        if 'updated_at' not in columns:
            cursor.execute("ALTER TABLE Products ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    except Exception as e:
        print(f"Warning: {e}")
    
    try:
        cursor.execute("PRAGMA table_info(Orders)")
        columns = [col[1] for col in cursor.fetchall()]
        if 'updated_at' not in columns:
            cursor.execute("ALTER TABLE Orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    except Exception as e:
        print(f"Warning: {e}")
    
    conn.commit()
    
    # Sample categories
    categories = [
        "Electronics", "Home & Kitchen", "Sports & Outdoors", 
        "Clothing", "Books", "Toys & Games", "Beauty", "Automotive"
    ]
    
    # Sample products
    product_names = [
        ("Wireless Headphones", "Electronics"),
        ("Coffee Maker", "Home & Kitchen"),
        ("Running Shoes", "Sports & Outdoors"),
        ("Cotton T-Shirt", "Clothing"),
        ("Python Programming Book", "Books"),
        ("Board Game Set", "Toys & Games"),
        ("Facial Cleanser", "Beauty"),
        ("Car Phone Mount", "Automotive"),
        ("Bluetooth Speaker", "Electronics"),
        ("Kitchen Knife Set", "Home & Kitchen"),
        ("Yoga Mat", "Sports & Outdoors"),
        ("Jeans", "Clothing"),
        ("JavaScript Guide", "Books"),
        ("Puzzle Set", "Toys & Games"),
        ("Moisturizer", "Beauty"),
        ("Car Charger", "Automotive"),
        ("Smart Watch", "Electronics"),
        ("Dinnerware Set", "Home & Kitchen"),
        ("Dumbbells", "Sports & Outdoors"),
        ("Sweater", "Clothing"),
    ]
    
    print("\n1. Creating sample products...")
    product_ids = []
    for i, (name, category) in enumerate(product_names):
        product_id = f"PROD{str(i+1).zfill(6)}"
        product_ids.append(product_id)
        
        cursor.execute("""
            INSERT OR REPLACE INTO Products 
            (product_id, title, description, weight_g, length_cm, height_cm, width_cm, 
             category_name, photos_qty, version, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        """, (
            product_id,
            name,
            f"High quality {name.lower()}",
            random.randint(100, 5000),
            random.randint(10, 50),
            random.randint(5, 30),
            random.randint(10, 40),
            category,
            random.randint(1, 5)
        ))
        
        # Create inventory
        available = random.randint(10, 200)
        reserved = random.randint(0, min(20, available))
        cursor.execute("""
            INSERT OR REPLACE INTO Inventory 
            (product_id, available_qty, reserved_qty, restock_date)
            VALUES (?, ?, ?, ?)
        """, (
            product_id,
            available,
            reserved,
            None if available > 50 else (datetime.now() + timedelta(days=random.randint(1, 30))).strftime('%Y-%m-%d')
        ))
    
    print(f"   ✓ Created {len(product_ids)} products")
    
    # Sample customers
    print("\n2. Creating sample customers...")
    customer_ids = []
    cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego"]
    states = ["NY", "CA", "IL", "TX", "AZ", "PA", "TX", "CA"]
    
    for i in range(20):
        customer_id = f"CUST{str(i+1).zfill(6)}"
        customer_ids.append(customer_id)
        city_idx = i % len(cities)
        
        cursor.execute("""
            INSERT OR REPLACE INTO Customers 
            (customer_id, customer_unique_id, name, email, phone, zip_code, city, state)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            customer_id,
            f"UNIQUE_{i+1}",
            f"Customer {i+1}",
            f"customer{i+1}@example.com",
            f"555-{random.randint(1000, 9999)}",
            f"{random.randint(10000, 99999)}",
            cities[city_idx],
            states[city_idx]
        ))
    
    print(f"   ✓ Created {len(customer_ids)} customers")
    
    # Sample orders
    print("\n3. Creating sample orders...")
    order_statuses = ['pending', 'processing', 'shipped', 'delivered', 'delivered']
    order_ids = []
    
    for i in range(30):
        order_id = f"ORDER{str(i+1).zfill(6)}"
        order_ids.append(order_id)
        customer_id = random.choice(customer_ids)
        status = random.choice(order_statuses)
        purchase_date = datetime.now() - timedelta(days=random.randint(0, 90))
        
        cursor.execute("""
            INSERT OR REPLACE INTO Orders 
            (order_id, customer_id, status, purchase_ts, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            order_id,
            customer_id,
            status,
            purchase_date.isoformat(),
            purchase_date.isoformat()
        ))
        
        # Order items
        num_items = random.randint(1, 4)
        for j in range(num_items):
            product_id = random.choice(product_ids)
            quantity = random.randint(1, 3)
            unit_price = round(random.uniform(10.0, 299.99), 2)
            freight = round(random.uniform(5.0, 15.0), 2)
            
            cursor.execute("""
                INSERT OR REPLACE INTO Order_Items 
                (order_id, product_id, quantity, unit_price, freight_value)
                VALUES (?, ?, ?, ?, ?)
            """, (order_id, product_id, quantity, unit_price, freight))
        
        # Payment
        payment_methods = ['credit_card', 'debit_card', 'boleto', 'voucher']
        cursor.execute("""
            INSERT OR REPLACE INTO Payments 
            (order_id, payment_sequential, method, installment_no, total_installments, amount)
            VALUES (?, 1, ?, 1, 1, ?)
        """, (
            order_id,
            random.choice(payment_methods),
            round(random.uniform(20.0, 500.0), 2)
        ))
    
    print(f"   ✓ Created {len(order_ids)} orders")
    
    conn.commit()
    conn.close()
    
    print("\n" + "="*80)
    print("✓ Sample data populated successfully!")
    print("="*80)
    print(f"\nDatabase now contains:")
    print(f"  - {len(product_ids)} products")
    print(f"  - {len(customer_ids)} customers")
    print(f"  - {len(order_ids)} orders")
    print("\nYou can now refresh your dashboard to see the data!")

if __name__ == "__main__":
    populate_sample_data()

