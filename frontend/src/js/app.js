// Main Application Logic
class App {
    constructor() {
        this.currentScreen = 'home';
        this.currentUser = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
    }

    bindEvents() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        // Navigation buttons
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', this.handleNavigation.bind(this));
        });
    }

    async checkAuthStatus() {
        // First, check if token & user exist in localStorage (quick check)
        if (Auth.isLoggedIn()) {
            this.currentUser = Auth.getCurrentUser();
            this.showDashboard(); // Optimistically show dashboard

            // Then, verify token with backend in the background
            // If it fails, then redirect to login
            try {
                const stillValid = await Auth.verifyAuth(); // This still calls API.verifyToken()
                if (!stillValid) {
                    console.warn('Backend token verification failed after optimistic load. Redirecting to login.');
                    this.showHome(); // This will clear user and show login
                }
                // If stillValid is true, dashboard is already shown, user is fine.
            } catch (error) {
                // Error already handled by Auth.verifyAuth, which clears auth data
                // and would have made stillValid false.
                // showHome() would have been called by the !stillValid check.
            }
        } else {
            this.showHome(); // No token/user in localStorage, show login
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('login-error');

        try {
            // Hide any previous errors
            errorDiv.style.display = 'none';
            
            // Disable form during login
            const submitBtn = event.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';

            const result = await Auth.login(username, password);
            
            if (result.success) {
                this.currentUser = result.user;
                this.showDashboard();
            }
        } catch (error) {
            errorDiv.textContent = error.message || 'Login failed. Please try again.';
            errorDiv.style.display = 'block';
        } finally {
            // Re-enable form
            const submitBtn = event.target.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }

    async handleLogout() {
        try {
            await Auth.logout();
            this.currentUser = null;
            this.showHome();
        } catch (error) {
            console.error('Logout error:', error);
            // Still show home screen even if logout fails
            this.showHome();
        }
    }

    handleNavigation(event) {
        const section = event.target.dataset.section;
        
        // Update active navigation button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        // Load section content
        this.loadSection(section);
    }

    showHome() {
        this.showScreen('home-screen');
        this.currentScreen = 'home';
        
        // Clear form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.reset();
        }
        
        // Hide error messages
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    showDashboard() {
        this.showScreen('dashboard-screen');
        this.currentScreen = 'dashboard';
        
        // Update user info
        const userNameSpan = document.getElementById('user-name');
        if (userNameSpan && this.currentUser) {
            userNameSpan.textContent = `Welcome, ${this.currentUser.fullName || this.currentUser.firstName || this.currentUser.username}`;
        }

        // Reset navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show welcome message
        this.showWelcomeMessage();
    }

    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
    }

    showWelcomeMessage() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="welcome-message">
                    <h2>Welcome to LeekBrokerage Inc</h2>
                    <p>Select a section from the navigation above to get started.</p>
                    <div style="margin-top: 30px;">
                        <h3>Available Sections:</h3>
                        <ul style="text-align: left; max-width: 400px; margin: 20px auto;">
                            <li><strong>Freight Shipments:</strong> Track and manage freight shipments</li>
                            <li><strong>Invoicing Reports:</strong> View and generate invoicing reports</li>
                            <li><strong>Driver Commission:</strong> Manage driver commission reports</li>
                        </ul>
                    </div>
                </div>
            `;
        }
    }

    loadSection(section) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        switch (section) {
            case 'shipments':
                // Navigate to the dedicated shipments page
                window.location.href = 'shipments.html';
                break;
            case 'invoices':
                // Navigate to the dedicated invoices page
                window.location.href = 'invoices.html';
                break;
            case 'drivers':
                // Navigate to the dedicated driver commissions page
                window.location.href = 'driver-commissions.html';
                break;
            case 'users':
                // Navigate to the dedicated user management page
                window.location.href = 'driver-management.html'; // Corrected to reflect upcoming rename
                break;
            case 'customers':
                window.location.href = 'customers.html';
                break;
            default:
                this.showWelcomeMessage();
        }
    }

    // The loadShipmentsSection is removed as its functionality will be on shipments.html

    // The loadInvoicesSection is removed as its functionality will be on invoices.html

    // The loadDriversSection is removed as its functionality will be on driver-commissions.html
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});