// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';
window.API_BASE_URL = API_BASE_URL; // Make it globally accessible for invoices.js

// API Helper Functions
class API {
    static async makeRequest(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const token = localStorage.getItem('authToken');
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, finalOptions);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Health check
    static async checkHealth() {
        return this.makeRequest('/health');
    }

    // Authentication
    static async login(loginIdentifier, password) { // Changed 'username' param to 'loginIdentifier' for clarity
        return this.makeRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ login: loginIdentifier, password }) // Changed 'username' field to 'login'
        });
    }

    static async logout() {
        return this.makeRequest('/auth/logout', {
            method: 'POST'
        });
    }

    static async verifyToken() {
        // The /auth/profile route is protected by authenticateToken,
        // so successfully calling it verifies the token.
        return this.makeRequest('/auth/profile');
    }

    // Shipments
    static async getShipments(queryParams = '') { // Added queryParams parameter
        return this.makeRequest(`/shipments${queryParams}`); // Append queryParams
    }

    static async createShipment(shipmentData) {
        return this.makeRequest('/shipments', {
            method: 'POST',
            body: JSON.stringify(shipmentData)
        });
    }

    static async getShipmentById(id) {
        return this.makeRequest(`/shipments/${id}`);
    }

    static async updateShipment(id, shipmentData) {
        return this.makeRequest(`/shipments/${id}`, {
            method: 'PUT',
            body: JSON.stringify(shipmentData)
        });
    }

    static async deleteShipment(id) {
        return this.makeRequest(`/shipments/${id}`, {
            method: 'DELETE'
        });
    }

    // Invoices
    static async getInvoices(queryParams = '') { // Added queryParams parameter
        return this.makeRequest(`/invoices${queryParams}`); // Append queryParams
    }

    static async createInvoice(invoiceData) {
        return this.makeRequest('/invoices', {
            method: 'POST',
            body: JSON.stringify(invoiceData)
        });
    }

    static async getInvoiceById(id) { // Added for completeness, might be used by edit form later
        return this.makeRequest(`/invoices/${id}`);
    }

    static async updateInvoice(id, invoiceData) {
        return this.makeRequest(`/invoices/${id}`, {
            method: 'PUT',
            body: JSON.stringify(invoiceData)
        });
    }

    static async deleteInvoice(id) {
        return this.makeRequest(`/invoices/${id}`, {
            method: 'DELETE'
        });
    }

    // Drivers
    static async getDrivers() {
        return this.makeRequest('/drivers');
    }

    static async getDriverCommissions(driverId) {
        return this.makeRequest(`/drivers/${driverId}/commissions`);
    }

    // User Management
    static async getUsers() {
        return this.makeRequest('/users');
    }

    static async getUserById(id) { // For fetching full details if needed for an edit form
        return this.makeRequest(`/users/${id}`);
    }

    static async updateUser(id, userData) {
        return this.makeRequest(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    static async deleteUser(id) {
        return this.makeRequest(`/users/${id}`, {
            method: 'DELETE'
        });
    }
    // Note: User creation typically goes through /auth/register, which is already handled
    // by a direct call in user-management.js or could be wrapped here if preferred.

    // Customer Management
    static async getCustomers(queryParams = '') { // queryParams can be like '?isActive=true'
        return this.makeRequest(`/customers${queryParams}`);
    }

    static async getCustomerById(id) {
        return this.makeRequest(`/customers/${id}`);
    }

    static async createCustomer(customerData) {
        return this.makeRequest('/customers', {
            method: 'POST',
            body: JSON.stringify(customerData)
        });
    }

    static async updateCustomer(id, customerData) {
        return this.makeRequest(`/customers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(customerData)
        });
    }

    static async deleteCustomer(id) { // This will call the backend soft delete (deactivate)
        return this.makeRequest(`/customers/${id}`, {
            method: 'DELETE'
        });
    }
}