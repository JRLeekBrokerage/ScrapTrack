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
            body: JSON.stringify({ login: username, password })
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

    // Customers
    static async getCustomers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest(`/customers${queryString ? '?' + queryString : ''}`);
    }

    static async getCustomer(id) {
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

    static async deleteCustomer(id) {
        return this.makeRequest(`/customers/${id}`, {
            method: 'DELETE'
        });
    }

    static async getCustomerInvoices(id, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest(`/customers/${id}/invoices${queryString ? '?' + queryString : ''}`);
    }

    static async getCustomerStatistics(id) {
        return this.makeRequest(`/customers/${id}/statistics`);
    }

    // Invoices
    static async getInvoices(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest(`/invoices${queryString ? '?' + queryString : ''}`);
    }

    static async getInvoice(id) {
        return this.makeRequest(`/invoices/${id}`);
    }

    static async createInvoice(invoiceData) {
        return this.makeRequest('/invoices', {
            method: 'POST',
            body: JSON.stringify(invoiceData)
        });
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

    static async recordPayment(id, paymentData) {
        return this.makeRequest(`/invoices/${id}/payment`, {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }

    static async markInvoiceAsSent(id) {
        return this.makeRequest(`/invoices/${id}/send`, {
            method: 'POST'
        });
    }

    static async getInvoicePDF(id) {
        return this.makeRequest(`/invoices/${id}/pdf`);
    }

    static async getInvoiceStatistics(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest(`/invoices/statistics${queryString ? '?' + queryString : ''}`);
    }

    // Drivers
    static async getDrivers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest(`/drivers${queryString ? '?' + queryString : ''}`);
    }

    static async getDriver(id) {
        return this.makeRequest(`/drivers/${id}`);
    }

    static async getActiveDrivers() {
        return this.makeRequest('/drivers/active');
    }

    static async createDriver(driverData) {
        return this.makeRequest('/drivers', {
            method: 'POST',
            body: JSON.stringify(driverData)
        });
    }

    static async updateDriver(id, driverData) {
        return this.makeRequest(`/drivers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(driverData)
        });
    }

    static async deleteDriver(id) {
        return this.makeRequest(`/drivers/${id}`, {
            method: 'DELETE'
        });
    }

    static async getDriverCommissions(driverId, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest(`/drivers/${driverId}/commissions${queryString ? '?' + queryString : ''}`);
    }
}