from flask import Flask, request, jsonify
import os
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
from functools import wraps


app = Flask(__name__, template_folder="templates", static_folder="static")
# Configure SQLite database path for Render
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///' + os.path.join(app.instance_path, 'ev_charging.db'))
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
DB_FILE = "ev_charging.db"

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    isAdmin = db.Column(db.Boolean, default=False)
    bookings = db.relationship('Booking', backref='user', lazy=True)

class Station(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200), nullable=False)
    total_slots = db.Column(db.Integer, nullable=False)
    price_per_hour = db.Column(db.Float, nullable=False)
    image = db.Column(db.String(200))
    slots = db.relationship('Slot', backref='station', lazy=True)

class Slot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    station_id = db.Column(db.Integer, db.ForeignKey('station.id'), nullable=False)
    start_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    end_time = db.Column(db.String(5), nullable=False)    # Format: "HH:MM"
    status = db.Column(db.String(20), default='available')  # available, booked, maintenance
    bookings = db.relationship('Booking', backref='slot', lazy=True)

class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    slot_id = db.Column(db.Integer, db.ForeignKey('slot.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    vehicle_number = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='upcoming')  # upcoming, completed, cancelled

# Helper Functions
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            token = auth_header.split(" ")[1] if len(auth_header.split(" ")) > 1 else None
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if not current_user.isAdmin:
            return jsonify({'message': 'Admin access required!'}), 403
        return f(current_user, *args, **kwargs)
    return decorated

# Auth Routes
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Validate data
    if not all(key in data for key in ['name', 'email', 'password']):
        return jsonify({'message': 'Missing required fields'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already registered'}), 400
    
    hashed_password = generate_password_hash(data['password'], method='sha256')
    
    new_user = User(
        name=data['name'],
        email=data['email'],
        password=hashed_password,
        isAdmin=data.get('isAdmin', False)
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully'}), 201

# Hardcoded admin credentials (for demo only)
HARDCODED_ADMIN = {
    "email": "admin@example.com",
    "password": "admin123",  # In real apps, never store plaintext passwords!
    "isAdmin": True,
    "name": "Admin"
}

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    
    # Check hardcoded admin first
    if data['email'] == HARDCODED_ADMIN['email'] and data['password'] == HARDCODED_ADMIN['password']:
        token = jwt.encode({
            'user_id': 0,  # Use a fake ID (since no DB record exists)
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'])
        
        return jsonify({
            'token': token,
            'user': {
                'id': 0,
                'name': HARDCODED_ADMIN['name'],
                'email': HARDCODED_ADMIN['email'],
                'isAdmin': True
            }
        })
    
    # Normal user login (database check)
    user = User.query.filter_by(email=data['email']).first()
    if not user or not check_password_hash(user.password, data['password']):
        return jsonify({'message': 'Invalid credentials'}), 401
    
    token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'])
    
    return jsonify({
        'token': token,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'isAdmin': user.isAdmin
        }
    })

# Station Routes
@app.route('/api/stations', methods=['GET'])
def get_stations():
    stations = Station.query.all()
    
    result = []
    for station in stations:
        # Count available slots for each station
        available_slots = Slot.query.filter_by(station_id=station.id, status='available').count()
        
        result.append({
            'id': station.id,
            'name': station.name,
            'location': station.location,
            'total_slots': station.total_slots,
            'available_slots': available_slots,
            'price_per_hour': station.price_per_hour,
            'image': station.image
        })
    
    return jsonify(result)

@app.route('/api/stations/<int:station_id>', methods=['GET'])
def get_station(station_id):
    station = Station.query.get(station_id)
    
    if not station:
        return jsonify({'message': 'Station not found'}), 404
    
    available_slots = Slot.query.filter_by(station_id=station.id, status='available').count()
    
    return jsonify({
        'id': station.id,
        'name': station.name,
        'location': station.location,
        'total_slots': station.total_slots,
        'available_slots': available_slots,
        'price_per_hour': station.price_per_hour,
        'image': station.image
    })

@app.route('/api/stations', methods=['POST'])
@token_required
@admin_required
def create_station(current_user):
    data = request.get_json()
    
    if not all(key in data for key in ['name', 'location', 'total_slots', 'price_per_hour']):
        return jsonify({'message': 'Missing required fields'}), 400
    
    new_station = Station(
        name=data['name'],
        location=data['location'],
        total_slots=data['total_slots'],
        price_per_hour=data['price_per_hour'],
        image=data.get('image')
    )
    
    db.session.add(new_station)
    db.session.commit()
    
    return jsonify({'message': 'Station created successfully', 'id': new_station.id}), 201

@app.route('/api/stations/<int:station_id>', methods=['PUT'])
@token_required
@admin_required
def update_station(current_user, station_id):
    station = Station.query.get(station_id)
    
    if not station:
        return jsonify({'message': 'Station not found'}), 404
    
    data = request.get_json()
    
    station.name = data.get('name', station.name)
    station.location = data.get('location', station.location)
    station.total_slots = data.get('total_slots', station.total_slots)
    station.price_per_hour = data.get('price_per_hour', station.price_per_hour)
    station.image = data.get('image', station.image)
    
    db.session.commit()
    
    return jsonify({'message': 'Station updated successfully'})

@app.route('/api/stations/<int:station_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_station(current_user, station_id):
    station = Station.query.get(station_id)
    
    if not station:
        return jsonify({'message': 'Station not found'}), 404
    
    # Delete associated slots and bookings
    slots = Slot.query.filter_by(station_id=station_id).all()
    for slot in slots:
        Booking.query.filter_by(slot_id=slot.id).delete()
    
    Slot.query.filter_by(station_id=station_id).delete()
    db.session.delete(station)
    db.session.commit()
    
    return jsonify({'message': 'Station deleted successfully'})

# Slot Routes
@app.route('/api/stations/<int:station_id>/slots', methods=['GET'])
def get_slots(station_id):
    slots = Slot.query.filter_by(station_id=station_id).all()
    
    result = []
    for slot in slots:
        result.append({
            'id': slot.id,
            'start_time': slot.start_time,
            'end_time': slot.end_time,
            'status': slot.status
        })
    
    return jsonify(result)

@app.route('/api/slots/<int:slot_id>', methods=['GET'])
def get_slot(slot_id):
    slot = Slot.query.get(slot_id)
    
    if not slot:
        return jsonify({'message': 'Slot not found'}), 404
    
    return jsonify({
        'id': slot.id,
        'station_id': slot.station_id,
        'start_time': slot.start_time,
        'end_time': slot.end_time,
        'status': slot.status
    })

@app.route('/api/slots', methods=['POST'])
@token_required
@admin_required
def create_slot(current_user):
    data = request.get_json()
    
    if not all(key in data for key in ['station_id', 'start_time', 'end_time']):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Validate station exists
    station = Station.query.get(data['station_id'])
    if not station:
        return jsonify({'message': 'Station not found'}), 404
    
    new_slot = Slot(
        station_id=data['station_id'],
        start_time=data['start_time'],
        end_time=data['end_time'],
        status=data.get('status', 'available')
    )
    
    db.session.add(new_slot)
    db.session.commit()
    
    return jsonify({'message': 'Time slot created successfully', 'id': new_slot.id}), 201

@app.route('/api/slots/<int:slot_id>', methods=['PUT'])
@token_required
@admin_required
def update_slot(current_user, slot_id):
    slot = Slot.query.get(slot_id)
    
    if not slot:
        return jsonify({'message': 'Slot not found'}), 404
    
    data = request.get_json()
    
    slot.start_time = data.get('start_time', slot.start_time)
    slot.end_time = data.get('end_time', slot.end_time)
    slot.status = data.get('status', slot.status)
    
    db.session.commit()
    
    return jsonify({'message': 'Time slot updated successfully'})

@app.route('/api/slots/<int:slot_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_slot(current_user, slot_id):
    slot = Slot.query.get(slot_id)
    
    if not slot:
        return jsonify({'message': 'Slot not found'}), 404
    
    # Delete associated bookings
    Booking.query.filter_by(slot_id=slot_id).delete()
    db.session.delete(slot)
    db.session.commit()
    
    return jsonify({'message': 'Time slot deleted successfully'})

# Booking Routes
@app.route('/api/bookings', methods=['GET'])
@token_required
def get_user_bookings(current_user):
    bookings = Booking.query.filter_by(user_id=current_user.id).order_by(Booking.date).all()
    
    result = []
    for booking in bookings:
        slot = Slot.query.get(booking.slot_id)
        station = Station.query.get(slot.station_id)
        
        result.append({
            'id': booking.id,
            'station_name': station.name,
            'date': booking.date.isoformat(),
            'start_time': slot.start_time,
            'end_time': slot.end_time,
            'vehicle_number': booking.vehicle_number,
            'status': booking.status
        })
    
    return jsonify(result)

@app.route('/api/bookings/all', methods=['GET'])
@token_required
@admin_required
def get_all_bookings(current_user):
    bookings = Booking.query.order_by(Booking.date).all()
    
    result = []
    for booking in bookings:
        user = User.query.get(booking.user_id)
        slot = Slot.query.get(booking.slot_id)
        station = Station.query.get(slot.station_id)
        
        result.append({
            'id': booking.id,
            'user_name': user.name,
            'station_name': station.name,
            'date': booking.date.isoformat(),
            'start_time': slot.start_time,
            'end_time': slot.end_time,
            'vehicle_number': booking.vehicle_number,
            'status': booking.status
        })
    
    return jsonify(result)

@app.route('/api/bookings', methods=['POST'])
@token_required
def create_booking(current_user):
    data = request.get_json()
    
    if not all(key in data for key in ['slot_id', 'date', 'vehicle_number']):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Check if slot exists and is available
    slot = Slot.query.get(data['slot_id'])
    if not slot:
        return jsonify({'message': 'Time slot not found'}), 404
    
    if slot.status != 'available':
        return jsonify({'message': 'This time slot is not available'}), 400
    
    # Check if date is valid (not in the past)
    try:
        booking_date = datetime.datetime.strptime(data['date'], '%Y-%m-%d').date()
    except:
        return jsonify({'message': 'Invalid date format'}), 400
    
    if booking_date < datetime.date.today():
        return jsonify({'message': 'Cannot book for past dates'}), 400
    
    # Check if user already has a booking for this date and time
    existing_booking = Booking.query.filter_by(
        user_id=current_user.id,
        date=booking_date
    ).join(Slot).filter(
        (Slot.start_time == slot.start_time) &
        (Slot.end_time == slot.end_time)
    ).first()
    
    if existing_booking:
        return jsonify({'message': 'You already have a booking for this time slot'}), 400
    
    new_booking = Booking(
        user_id=current_user.id,
        slot_id=data['slot_id'],
        date=booking_date,
        vehicle_number=data['vehicle_number'],
        status='upcoming'
    )
    
    # Mark slot as booked
    slot.status = 'booked'
    
    db.session.add(new_booking)
    db.session.commit()
    
    return jsonify({'message': 'Booking created successfully', 'id': new_booking.id}), 201

@app.route('/api/bookings/<int:booking_id>', methods=['DELETE'])
@token_required
def cancel_booking(current_user, booking_id):
    booking = Booking.query.get(booking_id)
    
    if not booking:
        return jsonify({'message': 'Booking not found'}), 404
    
    # Check if booking belongs to the user (unless admin)
    if booking.user_id != current_user.id and not current_user.isAdmin:
        return jsonify({'message': 'Unauthorized to cancel this booking'}), 403
    
    # Check if booking can be cancelled (status is upcoming)
    if booking.status != 'upcoming':
        return jsonify({'message': 'Only upcoming bookings can be cancelled'}), 400
    
    # Mark slot as available again
    slot = Slot.query.get(booking.slot_id)
    slot.status = 'available'
    
    # Update booking status
    booking.status = 'cancelled'
    
    db.session.commit()
    
    return jsonify({'message': 'Booking cancelled successfully'})

# User Routes
@app.route('/api/users', methods=['GET'])
@token_required
@admin_required
def get_users(current_user):
    users = User.query.all()
    
    result = []
    for user in users:
        result.append({
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'isAdmin': user.isAdmin
        })
    
    return jsonify(result)

@app.route('/api/users/<int:user_id>/make-admin', methods=['PUT'])
@token_required
@admin_required
def make_admin(current_user, user_id):
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    if user.isAdmin:
        return jsonify({'message': 'User is already an admin'}), 400
    
    user.isAdmin = True
    db.session.commit()
    
    return jsonify({'message': 'User promoted to admin successfully'})

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_user(current_user, user_id):
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    if user.id == current_user.id:
        return jsonify({'message': 'Cannot delete yourself'}), 400
    
    # Delete user's bookings
    bookings = Booking.query.filter_by(user_id=user_id).all()
    for booking in bookings:
        # Mark slots as available again
        slot = Slot.query.get(booking.slot_id)
        if booking.status == 'upcoming':
            slot.status = 'available'
    
    Booking.query.filter_by(user_id=user_id).delete()
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'User deleted successfully'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)