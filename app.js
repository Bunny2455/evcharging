document.addEventListener('DOMContentLoaded', function() {
    // Check auth status
    checkAuthStatus();
    
    // Setup event listeners
    document.getElementById('home-link').addEventListener('click', loadHomePage);
    document.getElementById('stations-link').addEventListener('click', loadStationsPage);
    document.getElementById('bookings-link').addEventListener('click', loadBookingsPage);
    document.getElementById('login-link').addEventListener('click', loadLoginPage);
    document.getElementById('admin-link').addEventListener('click', loadAdminPage);
    document.getElementById('book-now-btn').addEventListener('click', loadStationsPage);
    
    // Load home page by default
    loadHomePage();
});

function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    
    if (token) {
        document.getElementById('login-link').textContent = 'Logout';
        document.getElementById('login-link').id = 'logout-link';
        document.getElementById('logout-link').addEventListener('click', logout);
        
        if (isAdmin) {
            document.getElementById('admin-link').style.display = 'block';
        }
    }
}

async function loadHomePage() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <section class="hero">
            <h1>Book Your EV Charging Slot</h1>
            <p>Find and reserve charging stations near you</p>
            <button id="book-now-btn">Book Now</button>
        </section>
    `;
    document.getElementById('book-now-btn').addEventListener('click', loadStationsPage);
}

async function loadStationsPage() {
    try {
        const response = await fetch('/api/stations');
        const stations = await response.json();
        
        let stationsHTML = '<h2>Available Charging Stations</h2><div class="stations-list">';
        
        stations.forEach(station => {
            stationsHTML += `
                <div class="station-card" data-id="${station.id}">
                    <div class="station-image" style="background-image: url('${station.image || 'default-station.jpg'}')"></div>
                    <div class="station-info">
                        <h3>${station.name}</h3>
                        <p>${station.location}</p>
                        <p>${station.available_slots} / ${station.total_slots} slots available</p>
                        <p class="available-slots">$${station.price_per_hour}/hour</p>
                        <button class="view-slots-btn" data-id="${station.id}">View Slots</button>
                    </div>
                </div>
            `;
        });
        
        stationsHTML += '</div>';
        
        document.getElementById('main-content').innerHTML = stationsHTML;
        
        // Add event listeners to view slots buttons
        document.querySelectorAll('.view-slots-btn').forEach(button => {
            button.addEventListener('click', function() {
                loadSlotsPage(this.getAttribute('data-id'));
            });
        });
    } catch (error) {
        console.error('Error loading stations:', error);
        document.getElementById('main-content').innerHTML = `
            <div class="error-message">
                <p>Failed to load charging stations. Please try again later.</p>
            </div>
        `;
    }
}

async function loadSlotsPage(stationId) {
    try {
        const [stationResponse, slotsResponse] = await Promise.all([
            fetch(`/api/stations/${stationId}`),
            fetch(`/api/stations/${stationId}/slots`)
        ]);
        
        const station = await stationResponse.json();
        const slots = await slotsResponse.json();
        
        let slotsHTML = `
            <div class="booking-form">
                <h2>${station.name}</h2>
                <p>${station.location}</p>
                <div class="form-group">
                    <label for="booking-date">Select Date:</label>
                    <input type="date" id="booking-date" min="${new Date().toISOString().split('T')[0]}">
                </div>
                <h3>Available Time Slots</h3>
                <div class="slot-grid" id="slot-grid">
        `;
        
        slots.forEach(slot => {
            const isAvailable = slot.status === 'available';
            slotsHTML += `
                <div class="slot ${isAvailable ? 'available' : 'booked'}" 
                     data-id="${slot.id}" 
                     data-time="${slot.start_time}-${slot.end_time}"
                     ${!isAvailable ? 'title="This slot is already booked"' : ''}>
                    ${slot.start_time} - ${slot.end_time}
                </div>
            `;
        });
        
        slotsHTML += `
                </div>
                <div class="form-group">
                    <label for="vehicle-number">Vehicle Number:</label>
                    <input type="text" id="vehicle-number" required>
                </div>
                <button id="confirm-booking-btn">Confirm Booking</button>
            </div>
        `;
        
        document.getElementById('main-content').innerHTML = slotsHTML;
        
        // Add event listeners to slots
        document.querySelectorAll('.slot.available').forEach(slot => {
            slot.addEventListener('click', function() {
                document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
                this.classList.add('selected');
            });
        });
        
        // Add event listener to confirm booking button
        document.getElementById('confirm-booking-btn').addEventListener('click', async function() {
            const selectedSlot = document.querySelector('.slot.selected');
            const bookingDate = document.getElementById('booking-date').value;
            const vehicleNumber = document.getElementById('vehicle-number').value;
            
            if (!selectedSlot || !bookingDate || !vehicleNumber) {
                alert('Please select a slot, date, and enter your vehicle number');
                return;
            }
            
            try {
                const response = await fetch('/api/bookings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        slot_id: selectedSlot.getAttribute('data-id'),
                        date: bookingDate,
                        vehicle_number: vehicleNumber
                    })
                });
                
                if (response.ok) {
                    alert('Booking confirmed successfully!');
                    loadBookingsPage();
                } else {
                    const error = await response.json();
                    alert(`Booking failed: ${error.message}`);
                }
            } catch (error) {
                console.error('Booking error:', error);
                alert('Failed to confirm booking. Please try again.');
            }
        });
    } catch (error) {
        console.error('Error loading slots:', error);
        document.getElementById('main-content').innerHTML = `
            <div class="error-message">
                <p>Failed to load time slots. Please try again later.</p>
            </div>
        `;
    }
}

async function loadBookingsPage() {
    try {
        const response = await fetch('/api/bookings', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch bookings');
        
        const bookings = await response.json();
        
        let bookingsHTML = `
            <section class="bookings-list">
                <h2>My Bookings</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Station</th>
                            <th>Date</th>
                            <th>Time Slot</th>
                            <th>Vehicle</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        bookings.forEach(booking => {
            bookingsHTML += `
                <tr>
                    <td>${booking.station_name}</td>
                    <td>${new Date(booking.date).toLocaleDateString()}</td>
                    <td>${booking.start_time} - ${booking.end_time}</td>
                    <td>${booking.vehicle_number}</td>
                    <td>${booking.status}</td>
                    <td>
                        ${booking.status === 'upcoming' ? 
                          `<button class="cancel-booking-btn" data-id="${booking.id}">Cancel</button>` : 
                          ''}
                    </td>
                </tr>
            `;
        });
        
        bookingsHTML += `
                    </tbody>
                </table>
            </section>
        `;
        
        document.getElementById('main-content').innerHTML = bookingsHTML;
        
        // Add event listeners to cancel buttons
        document.querySelectorAll('.cancel-booking-btn').forEach(button => {
            button.addEventListener('click', async function() {
                if (confirm('Are you sure you want to cancel this booking?')) {
                    try {
                        const response = await fetch(`/api/bookings/${this.getAttribute('data-id')}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });
                        
                        if (response.ok) {
                            alert('Booking cancelled successfully');
                            loadBookingsPage();
                        } else {
                            const error = await response.json();
                            alert(`Cancellation failed: ${error.message}`);
                        }
                    } catch (error) {
                        console.error('Cancellation error:', error);
                        alert('Failed to cancel booking. Please try again.');
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error loading bookings:', error);
        document.getElementById('main-content').innerHTML = `
            <div class="error-message">
                <p>${error.message || 'Failed to load bookings. Please try again later.'}</p>
            </div>
        `;
    }
}

function loadLoginPage() {
    document.getElementById('main-content').innerHTML = `
        <section class="login-form">
            <h2>Login</h2>
            <form id="login-form">
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" required>
                </div>
                <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" required>
                </div>
                <button type="submit">Login</button>
            </form>
            <p>Don't have an account? <a href="#" id="register-link">Register</a></p>
        </section>
    `;
    
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('isAdmin', data.user.isAdmin);
                
                checkAuthStatus();
                loadHomePage();
            } else {
                const error = await response.json();
                alert(`Login failed: ${error.message}`);
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Failed to login. Please try again.');
        }
    });
    
    document.getElementById('register-link').addEventListener('click', loadRegisterPage);
}

function loadRegisterPage() {
    document.getElementById('main-content').innerHTML = `
        <section class="login-form">
            <h2>Register</h2>
            <form id="register-form">
                <div class="form-group">
                    <label for="reg-name">Full Name:</label>
                    <input type="text" id="reg-name" required>
                </div>
                <div class="form-group">
                    <label for="reg-email">Email:</label>
                    <input type="email" id="reg-email" required>
                </div>
                <div class="form-group">
                    <label for="reg-password">Password:</label>
                    <input type="password" id="reg-password" required>
                </div>
                <div class="form-group">
                    <label for="reg-confirm-password">Confirm Password:</label>
                    <input type="password" id="reg-confirm-password" required>
                </div>
                <button type="submit">Register</button>
            </form>
            <p>Already have an account? <a href="#" id="login-link-2">Login</a></p>
        </section>
    `;
    
    document.getElementById('register-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });
            
            if (response.ok) {
                alert('Registration successful. Please login.');
                loadLoginPage();
            } else {
                const error = await response.json();
                alert(`Registration failed: ${error.message}`);
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Failed to register. Please try again.');
        }
    });
    
    document.getElementById('login-link-2').addEventListener('click', loadLoginPage);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isAdmin');
    
    // Reset the logout link back to login
    const logoutLink = document.getElementById('logout-link');
    logoutLink.textContent = 'Login';
    logoutLink.id = 'login-link';
    logoutLink.removeEventListener('click', logout);
    document.getElementById('login-link').addEventListener('click', loadLoginPage);
    
    // Hide admin link if visible
    document.getElementById('admin-link').style.display = 'none';
    
    loadHomePage();
}

async function loadAdminPage() {
    try {
        // Check if user is admin
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        if (!isAdmin) {
            alert('Access denied. Admin privileges required.');
            loadHomePage();
            return;
        }
        
        // Load admin dashboard
        document.getElementById('main-content').innerHTML = `
            <div class="admin-panel">
                <h1>Admin Dashboard</h1>
                <div class="tabs">
                    <div class="tab active" data-tab="stations">Stations</div>
                    <div class="tab" data-tab="slots">Slots</div>
                    <div class="tab" data-tab="bookings">Bookings</div>
                    <div class="tab" data-tab="users">Users</div>
                </div>
                
                <div class="tab-content active" id="stations-tab">
                    <h2>Manage Charging Stations</h2>
                    <button id="add-station-btn">Add New Station</button>
                    <table class="form-table" id="stations-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Location</th>
                                <th>Total Slots</th>
                                <th>Price/Hour</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
                
                <div class="tab-content" id="slots-tab">
                    <h2>Manage Time Slots</h2>
                    <div class="form-group">
                        <label for="station-select">Select Station:</label>
                        <select id="station-select"></select>
                    </div>
                    <button id="add-slot-btn">Add New Slot</button>
                    <table class="form-table" id="slots-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Start Time</th>
                                <th>End Time</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
                
                <div class="tab-content" id="bookings-tab">
                    <h2>Manage Bookings</h2>
                    <table class="form-table" id="bookings-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
                                <th>Station</th>
                                <th>Date</th>
                                <th>Time Slot</th>
                                <th>Vehicle</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
                
                <div class="tab-content" id="users-tab">
                    <h2>Manage Users</h2>
                    <table class="form-table" id="users-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            
            <!-- Station Modal -->
            <div id="station-modal" class="modal">
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2 id="station-modal-title">Add New Station</h2>
                    <form id="station-form">
                        <input type="hidden" id="station-id">
                        <div class="form-group">
                            <label for="station-name">Station Name:</label>
                            <input type="text" id="station-name" required>
                        </div>
                        <div class="form-group">
                            <label for="station-location">Location:</label>
                            <input type="text" id="station-location" required>
                        </div>
                        <div class="form-group">
                            <label for="station-slots">Total Slots:</label>
                            <input type="number" id="station-slots" min="1" required>
                        </div>
                        <div class="form-group">
                            <label for="station-price">Price Per Hour ($):</label>
                            <input type="number" id="station-price" min="0" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label for="station-image">Image URL:</label>
                            <input type="text" id="station-image">
                        </div>
                        <button type="submit">Save</button>
                    </form>
                </div>
            </div>
            
            <!-- Slot Modal -->
            <div id="slot-modal" class="modal">
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2 id="slot-modal-title">Add New Time Slot</h2>
                    <form id="slot-form">
                        <input type="hidden" id="slot-id">
                        <input type="hidden" id="slot-station-id">
                        <div class="form-group">
                            <label for="slot-start">Start Time:</label>
                            <input type="time" id="slot-start" required>
                        </div>
                        <div class="form-group">
                            <label for="slot-end">End Time:</label>
                            <input type="time" id="slot-end" required>
                        </div>
                        <div class="form-group">
                            <label for="slot-status">Status:</label>
                            <select id="slot-status" required>
                                <option value="available">Available</option>
                                <option value="maintenance">Maintenance</option>
                            </select>
                        </div>
                        <button type="submit">Save</button>
                    </form>
                </div>
            </div>
        `;
        
        // Setup tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs and contents
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                this.classList.add('active');
                document.getElementById(`${this.getAttribute('data-tab')}-tab`).classList.add('active');
                
                // Load data for the tab if needed
                switch(this.getAttribute('data-tab')) {
                    case 'stations':
                        loadAdminStations();
                        break;
                    case 'slots':
                        loadAdminSlots();
                        break;
                    case 'bookings':
                        loadAdminBookings();
                        break;
                    case 'users':
                        loadAdminUsers();
                        break;
                }
            });
        });
        
        // Load initial data for stations tab
        await loadAdminStations();
        
        // Setup station modal
        const stationModal = document.getElementById('station-modal');
        const stationForm = document.getElementById('station-form');
        
        document.getElementById('add-station-btn').addEventListener('click', function() {
            document.getElementById('station-modal-title').textContent = 'Add New Station';
            stationForm.reset();
            document.getElementById('station-id').value = '';
            stationModal.style.display = 'block';
        });
        
        stationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const stationData = {
                name: document.getElementById('station-name').value,
                location: document.getElementById('station-location').value,
                total_slots: parseInt(document.getElementById('station-slots').value),
                price_per_hour: parseFloat(document.getElementById('station-price').value),
                image: document.getElementById('station-image').value
            };
            
            const stationId = document.getElementById('station-id').value;
            const url = stationId ? `/api/stations/${stationId}` : '/api/stations';
            const method = stationId ? 'PUT' : 'POST';
            
            try {
                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(stationData)
                });
                
                if (response.ok) {
                    stationModal.style.display = 'none';
                    loadAdminStations();
                } else {
                    const error = await response.json();
                    alert(`Operation failed: ${error.message}`);
                }
            } catch (error) {
                console.error('Error saving station:', error);
                alert('Failed to save station. Please try again.');
            }
        });
        
        // Setup slot modal
        const slotModal = document.getElementById('slot-modal');
        const slotForm = document.getElementById('slot-form');
        
        document.getElementById('add-slot-btn').addEventListener('click', function() {
            const stationId = document.getElementById('station-select').value;
            if (!stationId) {
                alert('Please select a station first');
                return;
            }
            
            document.getElementById('slot-modal-title').textContent = 'Add New Time Slot';
            slotForm.reset();
            document.getElementById('slot-id').value = '';
            document.getElementById('slot-station-id').value = stationId;
            slotModal.style.display = 'block';
        });
        
        slotForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const slotData = {
                start_time: document.getElementById('slot-start').value,
                end_time: document.getElementById('slot-end').value,
                status: document.getElementById('slot-status').value,
                station_id: document.getElementById('slot-station-id').value
            };
            
            const slotId = document.getElementById('slot-id').value;
            const url = slotId ? `/api/slots/${slotId}` : '/api/slots';
            const method = slotId ? 'PUT' : 'POST';
            
            try {
                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(slotData)
                });
                
                if (response.ok) {
                    slotModal.style.display = 'none';
                    loadAdminSlots();
                } else {
                    const error = await response.json();
                    alert(`Operation failed: ${error.message}`);
                }
            } catch (error) {
                console.error('Error saving slot:', error);
                alert('Failed to save time slot. Please try again.');
            }
        });
        
        // Close modals when clicking X
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', function() {
                this.closest('.modal').style.display = 'none';
            });
        });
        
        // Close modals when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
        });
        
    } catch (error) {
        console.error('Error loading admin page:', error);
        document.getElementById('main-content').innerHTML = `
            <div class="error-message">
                <p>Failed to load admin dashboard. Please try again later.</p>
            </div>
        `;
    }
}

async function loadAdminStations() {
    try {
        const response = await fetch('/api/stations', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch stations');
        
        const stations = await response.json();
        const tbody = document.querySelector('#stations-table tbody');
        tbody.innerHTML = '';
        
        stations.forEach(station => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${station.id}</td>
                <td>${station.name}</td>
                <td>${station.location}</td>
                <td>${station.total_slots}</td>
                <td>$${station.price_per_hour.toFixed(2)}</td>
                <td>
                    <button class="edit-station-btn" data-id="${station.id}">Edit</button>
                    <button class="delete-station-btn" data-id="${station.id}">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-station-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const stationId = this.getAttribute('data-id');
                try {
                    const response = await fetch(`/api/stations/${stationId}`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    
                    if (response.ok) {
                        const station = await response.json();
                        
                        document.getElementById('station-modal-title').textContent = 'Edit Station';
                        document.getElementById('station-id').value = station.id;
                        document.getElementById('station-name').value = station.name;
                        document.getElementById('station-location').value = station.location;
                        document.getElementById('station-slots').value = station.total_slots;
                        document.getElementById('station-price').value = station.price_per_hour;
                        document.getElementById('station-image').value = station.image || '';
                        
                        document.getElementById('station-modal').style.display = 'block';
                    } else {
                        const error = await response.json();
                        alert(`Failed to fetch station: ${error.message}`);
                    }
                } catch (error) {
                    console.error('Error fetching station:', error);
                    alert('Failed to fetch station details. Please try again.');
                }
            });
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-station-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const stationId = this.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this station? This will also delete all associated time slots and bookings.')) {
                    try {
                        const response = await fetch(`/api/stations/${stationId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });
                        
                        if (response.ok) {
                            loadAdminStations();
                        } else {
                            const error = await response.json();
                            alert(`Deletion failed: ${error.message}`);
                        }
                    } catch (error) {
                        console.error('Error deleting station:', error);
                        alert('Failed to delete station. Please try again.');
                    }
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading admin stations:', error);
        alert(error.message || 'Failed to load stations. Please try again later.');
    }
}

async function loadAdminSlots() {
    try {
        // First load stations for the dropdown
        const stationsResponse = await fetch('/api/stations', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!stationsResponse.ok) throw new Error('Failed to fetch stations');
        
        const stations = await stationsResponse.json();
        const stationSelect = document.getElementById('station-select');
        
        // Clear and populate station dropdown
        stationSelect.innerHTML = '';
        stations.forEach(station => {
            const option = document.createElement('option');
            option.value = station.id;
            option.textContent = station.name;
            stationSelect.appendChild(option);
        });
        
        // Load slots for the first station by default
        if (stations.length > 0) {
            await loadSlotsForStation(stations[0].id);
        }
        
        // Add event listener to station dropdown
        stationSelect.addEventListener('change', function() {
            loadSlotsForStation(this.value);
        });
        
    } catch (error) {
        console.error('Error loading admin slots:', error);
        alert(error.message || 'Failed to load slots. Please try again later.');
    }
}

async function loadSlotsForStation(stationId) {
    try {
        const response = await fetch(`/api/stations/${stationId}/slots`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch slots');
        
        const slots = await response.json();
        const tbody = document.querySelector('#slots-table tbody');
        tbody.innerHTML = '';
        
        slots.forEach(slot => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${slot.id}</td>
                <td>${slot.start_time}</td>
                <td>${slot.end_time}</td>
                <td>${slot.status}</td>
                <td>
                    <button class="edit-slot-btn" data-id="${slot.id}">Edit</button>
                    <button class="delete-slot-btn" data-id="${slot.id}">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-slot-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const slotId = this.getAttribute('data-id');
                try {
                    const response = await fetch(`/api/slots/${slotId}`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    
                    if (response.ok) {
                        const slot = await response.json();
                        
                        document.getElementById('slot-modal-title').textContent = 'Edit Time Slot';
                        document.getElementById('slot-id').value = slot.id;
                        document.getElementById('slot-station-id').value = slot.station_id;
                        document.getElementById('slot-start').value = slot.start_time;
                        document.getElementById('slot-end').value = slot.end_time;
                        document.getElementById('slot-status').value = slot.status;
                        
                        document.getElementById('slot-modal').style.display = 'block';
                    } else {
                        const error = await response.json();
                        alert(`Failed to fetch slot: ${error.message}`);
                    }
                } catch (error) {
                    console.error('Error fetching slot:', error);
                    alert('Failed to fetch slot details. Please try again.');
                }
            });
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-slot-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const slotId = this.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this time slot? This will also delete any associated bookings.')) {
                    try {
                        const response = await fetch(`/api/slots/${slotId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });
                        
                        if (response.ok) {
                            loadSlotsForStation(stationId);
                        } else {
                            const error = await response.json();
                            alert(`Deletion failed: ${error.message}`);
                        }
                    } catch (error) {
                        console.error('Error deleting slot:', error);
                        alert('Failed to delete time slot. Please try again.');
                    }
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading slots for station:', error);
        alert(error.message || 'Failed to load slots. Please try again later.');
    }
}

async function loadAdminBookings() {
    try {
        const response = await fetch('/api/bookings/all', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch bookings');
        
        const bookings = await response.json();
        const tbody = document.querySelector('#bookings-table tbody');
        tbody.innerHTML = '';
        
        bookings.forEach(booking => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${booking.id}</td>
                <td>${booking.user_name}</td>
                <td>${booking.station_name}</td>
                <td>${new Date(booking.date).toLocaleDateString()}</td>
                <td>${booking.start_time} - ${booking.end_time}</td>
                <td>${booking.vehicle_number}</td>
                <td>${booking.status}</td>
                <td>
                    ${booking.status === 'upcoming' ? 
                      `<button class="cancel-booking-admin-btn" data-id="${booking.id}">Cancel</button>` : 
                      ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Add event listeners to cancel buttons
        document.querySelectorAll('.cancel-booking-admin-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const bookingId = this.getAttribute('data-id');
                if (confirm('Are you sure you want to cancel this booking?')) {
                    try {
                        const response = await fetch(`/api/bookings/${bookingId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });
                        
                        if (response.ok) {
                            loadAdminBookings();
                        } else {
                            const error = await response.json();
                            alert(`Cancellation failed: ${error.message}`);
                        }
                    } catch (error) {
                        console.error('Error cancelling booking:', error);
                        alert('Failed to cancel booking. Please try again.');
                    }
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading admin bookings:', error);
        alert(error.message || 'Failed to load bookings. Please try again later.');
    }
}

async function loadAdminUsers() {
    try {
        const response = await fetch('/api/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch users');
        
        const users = await response.json();
        const tbody = document.querySelector('#users-table tbody');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.isAdmin ? 'Admin' : 'User'}</td>
                <td>
                    ${!user.isAdmin ? 
                      `<button class="make-admin-btn" data-id="${user.id}">Make Admin</button>` : 
                      ''}
                    <button class="delete-user-btn" data-id="${user.id}">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Add event listeners to make admin buttons
        document.querySelectorAll('.make-admin-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const userId = this.getAttribute('data-id');
                if (confirm('Are you sure you want to make this user an admin?')) {
                    try {
                        const response = await fetch(`/api/users/${userId}/make-admin`, {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });
                        
                        if (response.ok) {
                            loadAdminUsers();
                        } else {
                            const error = await response.json();
                            alert(`Operation failed: ${error.message}`);
                        }
                    } catch (error) {
                        console.error('Error making user admin:', error);
                        alert('Failed to update user. Please try again.');
                    }
                }
            });
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-user-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const userId = this.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this user? This will also delete all their bookings.')) {
                    try {
                        const response = await fetch(`/api/users/${userId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });
                        
                        if (response.ok) {
                            loadAdminUsers();
                        } else {
                            const error = await response.json();
                            alert(`Deletion failed: ${error.message}`);
                        }
                    } catch (error) {
                        console.error('Error deleting user:', error);
                        alert('Failed to delete user. Please try again.');
                    }
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading admin users:', error);
        alert(error.message || 'Failed to load users. Please try again later.');
    }
}