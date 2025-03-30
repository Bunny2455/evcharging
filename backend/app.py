from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime

app = Flask(__name__, static_folder='../frontend/static')
CORS(app)

# Database configuration
DATABASE = 'stationData.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        
        # Stations table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS stations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            slots_available INTEGER NOT NULL,
            status TEXT NOT NULL
        )
        """)
        
        # Bookings table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id INTEGER NOT NULL,
            user_email TEXT NOT NULL,
            booking_time TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (station_id) REFERENCES stations(id)
        )
        """)
        
        # Insert sample data if empty
        if cursor.execute("SELECT COUNT(*) FROM stations").fetchone()[0] == 0:
            cursor.executemany(
                "INSERT INTO stations (name, location, slots_available, status) VALUES (?, ?, ?, ?)",
                [
                    ('Station A', 'Downtown', 4, 'Open'),
                    ('Station B', 'Uptown', 2, 'Open'),
                    ('Station C', 'Suburb', 0, 'Closed')
                ]
            )
        db.commit()

# API Endpoints
@app.route('/api/stations', methods=['GET', 'POST'])
def handle_stations():
    db = get_db()
    if request.method == 'GET':
        stations = db.execute('SELECT * FROM stations').fetchall()
        return jsonify([dict(station) for station in stations])
    
    elif request.method == 'POST':
        data = request.get_json()
        db.execute(
            "INSERT INTO stations (name, location, slots_available, status) VALUES (?, ?, ?, ?)",
            (data['name'], data['location'], data['slotsAvailable'], data['status'])
        )
        db.commit()
        return jsonify({"message": "Station added successfully"}), 201

@app.route('/api/stations/<int:id>', methods=['PUT', 'DELETE'])
def handle_station(id):
    db = get_db()
    if request.method == 'PUT':
        data = request.get_json()
        db.execute(
            "UPDATE stations SET name=?, location=?, slots_available=?, status=? WHERE id=?",
            (data['name'], data['location'], data['slotsAvailable'], data['status'], id)
        )
        db.commit()
        return jsonify({"message": "Station updated successfully"})
    
    elif request.method == 'DELETE':
        db.execute("DELETE FROM stations WHERE id=?", (id,))
        db.commit()
        return jsonify({"message": "Station deleted successfully"})

@app.route('/api/bookings', methods=['POST'])
def create_booking():
    data = request.get_json()
    db = get_db()
    
    # Check slot availability
    station = db.execute(
        "SELECT slots_available FROM stations WHERE id=?", 
        (data['stationId'],)
    ).fetchone()
    
    if not station or station['slots_available'] <= 0:
        return jsonify({"error": "No slots available"}), 400
    
    # Create booking
    db.execute(
        "INSERT INTO bookings (station_id, user_email) VALUES (?, ?)",
        (data['stationId'], data['email'])
    )
    
    # Update available slots
    db.execute(
        "UPDATE stations SET slots_available = slots_available - 1 WHERE id=?",
        (data['stationId'],)
    )
    
    db.commit()
    return jsonify({"message": "Booking created successfully"}), 201

# Serve frontend files
@app.route('/')
def serve_index():
    return send_from_directory('../frontend/templates', 'Login.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend/templates', path)

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=3000)