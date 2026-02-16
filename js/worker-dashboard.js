// Worker Dashboard Authentication & Session Management

// Global variables
let currentUser = null;

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const token = localStorage.getItem('nearnect_token');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    if (!token || !userData._id) {
      console.log('No token or user data found, redirecting to login');
      window.location.href = 'login.html';
      return;
    }
    
    // Verify token with server
    const response = await fetch(`${window.API_BASE || ''}/api/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log('Token verification failed, redirecting to login');
      localStorage.removeItem('nearnect_token');
      localStorage.removeItem('userData');
      window.location.href = 'login.html';
      return;
    }
    
    // If we get here, token is valid
    currentUser = userData;
    initializeDashboard();
    
  } catch (error) {
    console.error('Authentication error:', error);
    window.location.href = 'login.html';
  }
});

/**
 * Check if user is authenticated and has valid session
 */
async function checkAuth() {
    try {
        // Check for token in localStorage
        const token = localStorage.getItem('workerToken');
        const userData = JSON.parse(localStorage.getItem('workerData') || '{}');
        
        // If no token or user data, not authenticated
        if (!token || !userData._id) {
            return false;
        }
        
        // Verify token with server
        const isValid = await verifyToken(token);
        
        if (isValid) {
            // Store user data globally
            currentUser = userData;
            return true;
        } else {
            // Clear invalid session
            clearSession();
            return false;
        }
    } catch (error) {
        console.error('Authentication check failed:', error);
        clearSession();
        return false;
    }
}

/**
 * Verify the authentication token with the server
 */
async function verifyToken(token) {
    try {
        // In a real app, you would make an API call to verify the token
        // For now, we'll do a basic check
        if (!token || typeof token !== 'string' || token.length < 10) {
            return false;
        }
        
        // For demo purposes, we'll consider any valid token as authenticated
        // In production, you would verify this with your backend
        return true;
        
        // Example of how it would work with a real API:
        /*
        const response = await fetch('/api/auth/verify-token', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Token verification failed');
        }
        
        const data = await response.json();
        return data.valid === true;
        */
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

function verifyToken(token) {
    // In a real app, this would verify the token with your backend
    // For now, we'll just check if it exists and has the right format
    return new Promise((resolve) => {
        if (!token || typeof token !== 'string' || token.length < 50) {
            resolve(false);
            return;
        }
        
        // Simulate API call
        setTimeout(() => {
            // In a real app, you would make an API call to verify the token
            // For now, we'll assume all tokens with length > 50 are valid
            resolve(true);
        }, 300);
    });
}

/**
 * Initialize the dashboard after successful authentication
 */
function initializeDashboard() {
    try {
        // Update UI with user data
        updateUserProfile(currentUser);
        
        // Setup event listeners
        setupEventListeners();
        
        // Load dashboard data
        loadDashboardData();
        
        // Show the dashboard (hide loading spinner)
        const loading = document.getElementById('loading');
        const dashboard = document.querySelector('.dashboard');
        
        if (loading) loading.style.display = 'none';
        if (dashboard) dashboard.style.display = 'flex';
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showError('Failed to initialize dashboard. Please refresh the page.');
    }
}

/**
 * Update the UI with user profile information
 */
function updateUserProfile(userData) {
    try {
        // Update profile section in the sidebar
        const profileName = document.getElementById('workerName');
        const profileRole = document.getElementById('workerRole');
        const welcomeMessage = document.getElementById('welcomeMessage');
        
        // Update profile info
        if (profileName) {
            profileName.textContent = userData.name || 'Worker';
        }
        
        if (profileRole) {
            let roleText = userData.skill || 'Service Provider';
            if (userData.rating) {
                roleText += ` • ${parseFloat(userData.rating).toFixed(1)} ★`;
            }
            profileRole.textContent = roleText;
        }
        
        // Update welcome message
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome back, ${userData.name || 'Worker'}!`;
        }
        
        // Update avatar if available
        const avatarElements = document.querySelectorAll('.avatar, .avatar-lg');
        if (userData.img && avatarElements.length > 0) {
            avatarElements.forEach(el => {
                el.style.backgroundImage = `url('${userData.img}')`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
            });
        }
    } catch (error) {
        console.error('Failed to update user profile:', error);
    }
}

/**
 * Setup all event listeners for the dashboard
 */
function setupEventListeners() {
    try {
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
        
        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', handleNavigation);
        });
        
        // View profile button
        const viewProfileBtn = document.getElementById('viewProfileBtn');
        if (viewProfileBtn) {
            viewProfileBtn.addEventListener('click', () => {
                window.location.href = 'worker-profile.html';
            });
        }
        
        // View public profile button
        const viewPublicBtn = document.getElementById('viewPublicBtn');
        if (viewPublicBtn) {
            viewPublicBtn.addEventListener('click', () => {
                if (currentUser && currentUser._id) {
                    window.open(`worker.html?id=${currentUser._id}`, '_blank');
                } else {
                    showError('Unable to open public profile. User ID not found.');
                }
            });
        }
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

/**
 * Handle user logout
 */
function handleLogout(e) {
    if (e) e.preventDefault();
    
    try {
        // Clear authentication data
        clearSession();
        
        // Show success message
        showMessage('You have been successfully logged out.');
        
        // Redirect to login page after a short delay
        setTimeout(() => {
            window.location.href = 'login.html?message=logged_out';
        }, 1000);
    } catch (error) {
        console.error('Logout error:', error);
        // Still redirect even if there's an error
        window.location.href = 'login.html';
    }
}

/**
 * Clear the current user session
 */
function clearSession() {
    try {
        // Clear all authentication related data
        localStorage.removeItem('workerToken');
        localStorage.removeItem('workerData');
        
        // Reset current user
        currentUser = null;
    } catch (error) {
        console.error('Error clearing session:', error);
    }
}

/**
 * Redirect to login page with optional redirect parameter
 */
function redirectToLogin() {
    const currentPath = window.location.pathname.split('/').pop() || 'worker-dashboard.html';
    window.location.href = `login.html?redirect=${encodeURIComponent(currentPath)}`;
}

/**
 * Show an error message to the user
 */
function showError(message) {
    console.error('Error:', message);
    // You can implement a toast notification system here
    alert(`Error: ${message}`);
}

/**
 * Show a success/info message to the user
 */
function showMessage(message, type = 'success') {
    console.log(`${type}:`, message);
    // You can implement a toast notification system here
    // For now, we'll just log to console
}
    
    // Redirect to login
    window.location.href = 'login.html';
}

function handleNavigation(e) {
    e.preventDefault();
    const target = this.getAttribute('href');
    if (target) {
        window.location.href = target;
    }
}

/**
 * Load dashboard data from the server
 */
async function loadDashboardData() {
    try {
        // Show loading state
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
        
        // In a real app, you would make API calls here
        console.log('Loading dashboard data for user:', currentUser?.email || 'Unknown');
        
        // Simulate API calls with Promise.all for parallel requests
        const [stats, upcomingBookings] = await Promise.all([
            fetchDashboardStats(),
            fetchUpcomingBookings()
        ]);
        
        // Update the UI with the fetched data
        updateDashboardStats(stats);
        renderUpcomingBookings(upcomingBookings);
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showError('Failed to load dashboard data. Please try again.');
    } finally {
        // Hide loading state
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

/**
 * Fetch dashboard statistics from the server
 */
async function fetchDashboardStats() {
    // In a real app, this would be an API call
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                jobsCompleted: Math.floor(Math.random() * 100) + 20,
                earnings: Math.floor(Math.random() * 50000) + 10000,
                rating: (Math.random() * 1 + 4).toFixed(1), // Random rating between 4.0 and 5.0
                activeJobs: Math.floor(Math.random() * 5) + 1,
                responseRate: Math.floor(Math.random() * 30) + 70, // 70-100%
                customerRating: (Math.random() * 1 + 4).toFixed(1) // 4.0-5.0
            });
        }, 800);
    });
}

/**
 * Fetch upcoming bookings from the server
 */
async function fetchUpcomingBookings() {
    // In a real app, this would be an API call
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockBookings = [
                {
                    id: 'b' + Math.random().toString(36).substr(2, 8),
                    customer: 'Rahul Sharma',
                    service: 'Plumbing Repair',
                    date: new Date(Date.now() + 86400000 * 2).toISOString(),
                    status: 'confirmed',
                    amount: 1500
                },
                {
                    id: 'b' + Math.random().toString(36).substr(2, 8),
                    customer: 'Priya Patel',
                    service: 'Bathroom Renovation',
                    date: new Date(Date.now() + 86400000 * 5).toISOString(),
                    status: 'pending',
                    amount: 5000
                }
            ];
            resolve(mockBookings);
        }, 1000);
    });
}

/**
 * Update the dashboard statistics in the UI
 */
function updateDashboardStats(stats) {
    if (!stats) return;
    
    try {
        // Update stats cards
        updateStatCard('jobsCompleted', stats.jobsCompleted || 0);
        updateStatCard('totalEarnings', `₹${(stats.earnings || 0).toLocaleString()}`);
        updateStatCard('avgRating', stats.rating ? `${stats.rating} ★` : 'N/A');
        updateStatCard('activeJobs', stats.activeJobs || 0);
        
        // Update any additional stats
        if (stats.responseRate !== undefined) {
            updateStatCard('responseRate', `${stats.responseRate}%`);
        }
        
        if (stats.customerRating) {
            updateStatCard('customerRating', `${stats.customerRating} ★`);
        }
    } catch (error) {
        console.error('Error updating dashboard stats:', error);
    }
}

/**
 * Update a specific stat card in the UI
 */
function updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

/**
 * Render upcoming bookings in the UI
 */
function renderUpcomingBookings(bookings = []) {
    const container = document.getElementById('upcomingBookings');
    if (!container) return;
    
    try {
        if (!bookings || bookings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="far fa-calendar-check"></i>
                    <p>No upcoming bookings</p>
                    <small>Your upcoming appointments will appear here</small>
                </div>
            `;
            return;
        }
        
        // Clear existing content
        container.innerHTML = '';
        
        // Sort bookings by date (nearest first)
        const sortedBookings = [...bookings].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        // Create booking cards
        sortedBookings.forEach(booking => {
            const bookingDate = new Date(booking.date);
            const formattedDate = bookingDate.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
            
            const timeString = bookingDate.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            const statusClass = booking.status === 'confirmed' ? 'status-confirmed' : 
                              booking.status === 'pending' ? 'status-pending' : 'status-other';
            
            const bookingElement = document.createElement('div');
            bookingElement.className = 'booking-card';
            bookingElement.innerHTML = `
                <div class="booking-header">
                    <h4>${booking.service || 'Service'}</h4>
                    <span class="status-badge ${statusClass}">${booking.status || 'pending'}</span>
                </div>
                <div class="booking-details">
                    <p><i class="far fa-user"></i> ${booking.customer || 'Customer'}</p>
                    <p><i class="far fa-calendar-alt"></i> ${formattedDate} at ${timeString}</p>
                    <p><i class="fas fa-rupee-sign"></i> ${booking.amount || '0'}</p>
                </div>
                <div class="booking-actions">
                    <button class="btn btn-outline btn-sm" onclick="viewBookingDetails('${booking.id}')">
                        <i class="far fa-eye"></i> View
                    </button>
                    ${booking.status === 'pending' ? `
                        <button class="btn btn-primary btn-sm" onclick="confirmBooking('${booking.id}')">
                            <i class="fas fa-check"></i> Confirm
                        </button>
                    ` : ''}
                </div>
            `;
            
            container.appendChild(bookingElement);
        });
        
    } catch (error) {
        console.error('Error rendering upcoming bookings:', error);
        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load bookings</p>
                <button class="btn btn-sm" onclick="loadDashboardData()">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
}

function updateDashboardStats(stats) {
    // Update stats cards
    const statElements = {
        'todayEarnings': { element: document.getElementById('todayEarnings'), prefix: '₹', suffix: '' },
        'activeBookings': { element: document.getElementById('activeBookings'), prefix: '', suffix: '' },
        'rating': { element: document.getElementById('avgRating'), prefix: '', suffix: '/5' },
        'responseTime': { element: document.getElementById('responseTime'), prefix: '', suffix: ' min' }
    };
    
    Object.entries(stats).forEach(([key, value]) => {
        if (statElements[key] && statElements[key].element) {
            statElements[key].element.textContent = 
                statElements[key].prefix + value + statElements[key].suffix;
        }
    });
}

function loadUpcomingBookings() {
    // In a real app, this would fetch from your API
    const sampleBookings = [
        {
            id: 1,
            time: '10:00 AM',
            service: 'Bathroom Pipe Leak',
            customer: 'John Smith',
            distance: '2.5 km away',
            status: 'upcoming'
        },
        {
            id: 2,
            time: '02:30 PM',
            service: 'Kitchen Sink Installation',
            customer: 'Sarah Johnson',
            distance: '1.8 km away',
            status: 'upcoming'
        }
    ];
    
    const container = document.getElementById('upcomingBookings');
    if (!container) return;
    
    container.innerHTML = sampleBookings.map(booking => `
        <div class="booking-item">
            <div class="booking-info">
                <div class="booking-time">${booking.time}</div>
                <div class="booking-details">
                    <h4>${booking.service}</h4>
                    <p>${booking.customer} • ${booking.distance}</p>
                </div>
            </div>
            <div class="booking-actions">
                <button class="btn btn-outline" onclick="viewBooking(${booking.id})">View</button>
                <button class="btn btn-primary" onclick="startService(${booking.id})">Start Service</button>
            </div>
        </div>
    `).join('');
}

// Global functions that can be called from HTML
window.viewBooking = function(bookingId) {
    alert(`Viewing booking #${bookingId}`);
    // In a real app, this would open a modal or navigate to booking details
};

window.startService = function(bookingId) {
    if (confirm('Start service for this booking?')) {
        alert(`Starting service for booking #${bookingId}`);
        // In a real app, this would update the booking status via API
    }
};
