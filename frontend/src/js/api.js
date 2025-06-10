// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

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
    static async login(username, password) {
        return this.makeRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    static async logout() {
        return this.makeRequest('/auth/logout', {
            method: 'POST'
        });
    }

    static async verifyToken() {
        return this.makeRequest('/auth/verify');
    }

    // Shipments
    static async getShipments() {
        return this.makeRequest('/shipments');
    }

    static async createShipment(shipmentData) {
        return this.makeRequest('/shipments', {
            method: 'POST',
            body: JSON.stringify(shipmentData)
        });
    }

    // Invoices
    static async getInvoices() {
        return this.makeRequest('/invoices');
    }

    static async createInvoice(invoiceData) {
        return this.makeRequest('/invoices', {
            method: 'POST',
            body: JSON.stringify(invoiceData)
        });
    }

    // Drivers
    static async getDrivers() {
        return this.makeRequest('/drivers');
    }

    static async getDriverCommissions(driverId) {
        return this.makeRequest(`/drivers/${driverId}/commissions`);
    }
}