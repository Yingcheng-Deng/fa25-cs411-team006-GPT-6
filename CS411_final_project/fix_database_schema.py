#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Migration script to add missing columns to existing database
Run this if you have an existing database that was created before the schema update
"""

import sqlite3
import os

# Database path (same as backend)
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ultimate_ecommerce.db')

def fix_schema():
    """Add missing columns to existing database"""
    if not os.path.exists(DATABASE):
        print(f"[ERROR] Database not found: {DATABASE}")
        print("   Please run cs411_final_project.py first to create the database.")
        return
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # Check if Products table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='Products'
        """)
        if not cursor.fetchone():
            print("[ERROR] Products table not found. Please run cs411_final_project.py first.")
            conn.close()
            return
        
        # Check existing columns in Products table
        cursor.execute("PRAGMA table_info(Products)")
        columns = [col[1] for col in cursor.fetchall()]
        print(f"Current Products table columns: {', '.join(columns)}")
        
        # Add version column if missing
        if 'version' not in columns:
            print("Adding 'version' column to Products table...")
            cursor.execute("ALTER TABLE Products ADD COLUMN version INTEGER DEFAULT 1")
            print("[OK] Added 'version' column")
        else:
            print("[OK] 'version' column already exists")
        
        # Add updated_at column if missing
        if 'updated_at' not in columns:
            print("Adding 'updated_at' column to Products table...")
            # SQLite doesn't support CURRENT_TIMESTAMP in ALTER TABLE, so add without default
            cursor.execute("ALTER TABLE Products ADD COLUMN updated_at TIMESTAMP")
            # Update existing rows to have current timestamp
            cursor.execute("UPDATE Products SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL")
            print("[OK] Added 'updated_at' column and updated existing rows")
        else:
            print("[OK] 'updated_at' column already exists")
        
        # Check Orders table
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='Orders'
        """)
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(Orders)")
            order_columns = [col[1] for col in cursor.fetchall()]
            print(f"\nCurrent Orders table columns: {', '.join(order_columns)}")
            
            # Add updated_at to Orders if missing
            if 'updated_at' not in order_columns:
                print("Adding 'updated_at' column to Orders table...")
                # SQLite doesn't support CURRENT_TIMESTAMP in ALTER TABLE, so add without default
                cursor.execute("ALTER TABLE Orders ADD COLUMN updated_at TIMESTAMP")
                # Update existing rows to have current timestamp
                cursor.execute("UPDATE Orders SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL")
                print("[OK] Added 'updated_at' column to Orders and updated existing rows")
            else:
                print("[OK] 'updated_at' column already exists in Orders")
        
        conn.commit()
        print("\n[SUCCESS] Database schema updated successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Error updating schema: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("Database Schema Migration Script")
    print("=" * 60)
    print(f"Database: {DATABASE}\n")
    fix_schema()

