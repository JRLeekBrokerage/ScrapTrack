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
        
        // Initialize invoice manager when app starts
        if (typeof invoiceManager !== 'undefined') {
            invoiceManager.init();
        }
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
        const isAuthenticated = await Auth.verifyAuth();
        
        if (isAuthenticated) {
            this.currentUser = Auth.getCurrentUser();
            this.showDashboard();
        } else {
            this.showHome();
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
            userNameSpan.textContent = `Welcome, ${this.currentUser.name}`;
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
                this.loadShipmentsSection();
                break;
            case 'invoices':
                this.loadInvoicesSection();
                break;
            case 'drivers':
                this.loadDriversSection();
                break;
            default:
                this.showWelcomeMessage();
        }
    }

    loadShipmentsSection() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div class="section-header">
                <h2>Freight Shipments</h2>
                <p>Manage and track freight shipments</p>
            </div>
            <div class="section-content">
                <p><em>Shipments section coming soon...</em></p>
                <p>This section will include:</p>
                <ul>
                    <li>Shipment tracking</li>
                    <li>Add new shipments</li>
                    <li>Update shipment status</li>
                    <li>View shipment history</li>
                </ul>
            </div>
        `;
    }

    loadInvoicesSection() {
        const mainContent = document.getElementById('main-content');
        
        // Check if invoice manager is loaded
        if (typeof invoiceManager !== 'undefined') {
            invoiceManager.displayInvoiceList(mainContent);
        } else {
            mainContent.innerHTML = `
                <div class="section-header">
                    <h2>Invoicing Reports</h2>
                    <p>View and manage invoicing reports</p>
                </div>
                <div class="section-content">
                    <p><em>Loading invoice module...</em></p>
                </div>
            `;
        }
    }

    loadDriversSection() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div class="section-header">
                <h2>Driver Commission Reports</h2>
                <p>Manage driver commissions and payments</p>
            </div>
            <div class="section-content">
                <p><em>Driver commission section coming soon...</em></p>
                <p>This section will include:</p>
                <ul>
                    <li>Commission calculations</li>
                    <li>Driver payment reports</li>
                    <li>Performance tracking</li>
                    <li>Payment history</li>
                </ul>
            </div>
        `;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});