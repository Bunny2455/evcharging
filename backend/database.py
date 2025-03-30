import sqlite3
from sqlite3 import Error

def create_connection(db_file):
    """Create a database connection to a SQLite database"""
    conn = None
    try:
        conn = sqlite3.connect(db_file)
        print(f"Connected to SQLite version {sqlite3.version}")
        return conn
    except Error as e:
        print(e)
    
    return conn

def initialize_database(conn):
    """Initialize database tables"""
    try:
        cursor = conn.cursor()
        
        # Create stations table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS stations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            slots_available INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('Open', 'Closed'))
        """)
        
        # Create bookings table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_name TEXT NOT NULL,
            location TEXT NOT NULL,
            slots_available INTEGER NOT NULL,
            status TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        """)
        
        conn.commit()
    except Error as e:
        print(e)