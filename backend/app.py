from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from database import create_connection, initialize_database
import os

app = Flask(__name__)
CORS(app)

# Database configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "stationData.db")

# Initialize database
conn = create_connection(DATABASE)
if conn is not None:
    initialize_database(conn)
else:
    print("Error! Cannot create the database connection.")

# Station endpoints
@app.route('/stations', methods=['GET'])
def get_stations():
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM stations")
        rows = cursor.fetchall()
        
        stations = []
        for row in rows:
            stations.append({
                'id': row[0],
                'name': row[1],
                'location': row[2],
                'slotsAvailable': row[3],
                'status': row[4]
            })
        
        return jsonify(stations)
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500

@app.route('/locations', methods=['GET'])
def get_locations():
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT location FROM stations")
        rows = cursor.fetchall()
        locations = [row[0] for row in rows]
        return jsonify(locations)
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stations/location/<location_name>', methods=['GET'])
def get_stations_by_location(location_name):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM stations WHERE location = ?", (location_name,))
        rows = cursor.fetchall()
        
        if not rows:
            return jsonify({'error': 'No stations found for the selected location'}), 404
            
        stations = []
        for row in rows:
            stations.append({
                'id': row[0],
                'name': row[1],
                'location': row[2],
                'slotsAvailable': row[3],
                'status': row[4]
            })
        
        return jsonify(stations)
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stations', methods=['POST'])
def add_station():
    data = request.get_json()
    required_fields = ['name', 'location', 'slotsAvailable', 'status']
    
    if not all(field in data for field in required_fields):
        return jsonify({'message': 'Missing required fields'}), 400
    
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO stations (name, location, slots_available, status) VALUES (?, ?, ?, ?)",
            (data['name'], data['location'], data['slotsAvailable'], data['status'])
        )
        conn.commit()
        return jsonify({'message': 'Station added successfully', 'id': cursor.lastrowid}), 201
    except sqlite3.Error as e:
        return jsonify({'message': 'Failed to add station', 'error': str(e)}), 500

# Add other endpoints following the same pattern...

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)