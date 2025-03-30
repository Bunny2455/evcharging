// frontend/auth.js

/**
 * Handles user authentication (login, registration, token management)
 */

// Store authentication token in localStorage
function storeAuthToken(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('isAdmin', user.isAdmin);
}

// Remove authentication data
function clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isAdmin');
}

// Check if user is logged in
function isLoggedIn() {
    return localStorage.getItem('token') !== null;
}

// Check if user is admin
function isAdmin() {
    return localStorage.getItem('isAdmin') === 'true';
}

// Get current user data
function getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Get authentication token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Handle user login
async function loginUser(email, password) {
    try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
        }

        const data = await response.json();
        storeAuthToken(data.token, data.user);
        return data.user;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// Handle user registration
async function registerUser(name, email, password) {
    try {
        const response = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Registration failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

// Handle user logout
function logoutUser() {
    clearAuthData();
    window.location.href = '/'; // Redirect to home page
}

// Verify token with server (optional)
async function verifyToken() {
    const token = getAuthToken();
    if (!token) return false;

    try {
        const response = await fetch('http://localhost:5000/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.ok;
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

// Make sure to include this script in your HTML:
// <script src="auth.js"></script>