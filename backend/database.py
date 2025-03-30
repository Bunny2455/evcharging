import sqlite3
from sqlite3 import Error

def create_connection(db_file="stationData.db"):
    conn = None
    try:
        conn = sqlite3.connect(db_file)
        conn.row_factory = sqlite3.Row  # Enable dictionary-like access
        return conn
    except Error as e:
        print(e)
    return conn