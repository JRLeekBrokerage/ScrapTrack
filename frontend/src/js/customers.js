// Customer Management Page Logic
class CustomersPage {
    constructor() {
        this.customers = [];
        this.currentUser = null;
        this.editingCustomerId = null;
        this.init();
    }

    init() {
        if (!Auth.isLoggedIn()) {
            window.location.href = 'index.html';
            return;
        }
        this.currentUser = Auth.getCurrentUser();
        this.updateUserInfo();
        this.bindEventListeners();
        this.loadCustomers();
    }

    updateUserInfo() {
        const userNameSpan = document.getElementById('user-name-customermgt');
        if (userNameSpan && this.currentUser) {
            userNameSpan.textContent = `Welcome, ${this.currentUser.fullName || this.currentUser.firstName || this.currentUser.username}`;
        }
    }

    bindEventListeners() {
        const logoutBtn = document.getElementById('logout-btn-customermgt');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        const backToDashboardBtn = document.getElementById('back-to-dashboard-btn-customermgt');
        if (backToDashboardBtn) {
            backToDashboardBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        const showAddCustomerModalBtn = document.getElementById('show-add-customer-modal-btn');
        if (showAddCustomerModalBtn) {
            showAddCustomerModalBtn.addEventListener('click', this.openCreateCustomerModal.bind(this));
        }

        const closeCustomerModalBtn = document.getElementById('close-customer-modal-btn');
        if (closeCustomerModalBtn) {
            closeCustomerModalBtn.addEventListener('click', this.closeCustomerModal.bind(this));
        }

        const customerForm = document.getElementById('customer-form');
        if (customerForm) {
            customerForm.addEventListener('submit', this.handleCustomerFormSubmit.bind(this));
        }
        
        const customerModal = document.getElementById('customer-form-modal');
        if (customerModal) {
            window.addEventListener('click', (event) => {
                if (event.target === customerModal) {
                    this.closeCustomerModal();
                }
            });
        }
    }

    async handleLogout() {
        try {
            await Auth.logout();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Logout failed. Please try again.');
            window.location.href = 'index.html';
        }
    }

    async loadCustomers() {
        const loadingMsg = document.getElementById('loading-customers-msg');
        const tableContainer = document.getElementById('customers-table-container');
        
        if (loadingMsg) loadingMsg.style.display = 'block';
        if (tableContainer) tableContainer.innerHTML = '';

        try {
            const response = await API.getCustomers(); // Assumes API.getCustomers() will be created
            if (response && Array.isArray(response.data)) {
                this.customers = response.data.filter(c => c.isActive !== false); // Filter out inactive by default
            } else {
                console.error('Unexpected response structure for customers:', response);
                this.customers = [];
            }
            if (loadingMsg) loadingMsg.style.display = 'none';
            this.renderCustomersTable();
        } catch (error) {
            console.error('Failed to load customers:', error);
            if (loadingMsg) loadingMsg.style.display = 'none';
            if (tableContainer) tableContainer.innerHTML = '<p class="error-message">Error loading customers. Please try again later.</p>';
            this.customers = [];
            this.renderCustomersTable();
        }
    }

    renderCustomersTable() {
        const tableContainer = document.getElementById('customers-table-container');
        if (!tableContainer) return;

        if (!this.customers || this.customers.length === 0) {
            tableContainer.innerHTML = '<p>No active customers found.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Contact Email</th>
                    <th>Contact Phone</th>
                    <th>Address</th>
                    <th>Fuel Surcharge Rate</th>
                    <th>Notes</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;

        const tbody = table.querySelector('tbody');
        this.customers.forEach(customer => {
            const row = tbody.insertRow();
            let addressString = 'N/A';
            if (customer.primaryAddress) {
                const parts = [
                    customer.primaryAddress.street,
                    customer.primaryAddress.city,
                    customer.primaryAddress.state,
                    customer.primaryAddress.zipCode,
                    customer.primaryAddress.country
                ].filter(Boolean); // Filter out null/undefined parts
                if (parts.length > 0) addressString = parts.join(', ');
            }

            row.innerHTML = `
                <td>${customer.name || 'N/A'}</td>
                <td>${customer.contactEmail || 'N/A'}</td>
                <td>${customer.contactPhone || 'N/A'}</td>
                <td>${addressString}</td>
                <td>${customer.fuelSurchargeRate != null ? (customer.fuelSurchargeRate * 100).toFixed(1) + '%' : 'N/A'}</td>
                <td>${customer.notes || ''}</td>
                <td>
                    <button class="btn-action btn-edit btn-edit-customer" data-id="${customer._id}">Edit</button>
                    <button class="btn-action btn-delete btn-delete-customer" data-id="${customer._id}" data-name="${customer.name}">Deactivate</button>
                </td>
            `;
            row.querySelector('.btn-edit-customer').addEventListener('click', (e) => this.openEditCustomerModal(e.target.dataset.id));
            row.querySelector('.btn-delete-customer').addEventListener('click', (e) => this.handleDeleteCustomer(e.target.dataset.id, e.target.dataset.name));
        });

        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    openCreateCustomerModal() {
        this.editingCustomerId = null;
        document.getElementById('customer-form-title').textContent = 'Add New Customer';
        document.getElementById('customer-form').reset();
        document.getElementById('customer-isActive').value = 'true'; // Default to active
        document.getElementById('customer-fuelSurchargeRate').value = ''; // Clear fuel surcharge rate for new customer
        document.getElementById('customer-form-modal').style.display = 'block';
    }

    async openEditCustomerModal(customerId) {
        this.editingCustomerId = customerId;
        // const customer = await API.getCustomerById(customerId); // Option: Fetch fresh data
        // For now, use data from the list for simplicity
        const customer = this.customers.find(c => c._id === customerId); 
        if (!customer || !customer.data) { // API.getCustomerById might wrap in .data
             const freshCustomerResponse = await API.getCustomerById(customerId);
             if (!freshCustomerResponse || !freshCustomerResponse.data) {
                alert('Error: Customer not found for editing.');
                return;
             }
             this.editingCustomerData = freshCustomerResponse.data; // Store for submit
        } else {
             this.editingCustomerData = customer.data; // Store for submit
        }
        const custData = this.editingCustomerData;


        document.getElementById('customer-form-title').textContent = 'Edit Customer';
        const form = document.getElementById('customer-form');
        form.reset();

        document.getElementById('customer-edit-id').value = custData._id;
        document.getElementById('customer-name').value = custData.name || '';
        document.getElementById('customer-contactEmail').value = custData.contactEmail || '';
        document.getElementById('customer-contactPhone').value = custData.contactPhone || '';
        document.getElementById('customer-notes').value = custData.notes || '';
        document.getElementById('customer-isActive').value = custData.isActive === false ? 'false' : 'true';
        document.getElementById('customer-fuelSurchargeRate').value = custData.fuelSurchargeRate != null ? (custData.fuelSurchargeRate * 100).toFixed(1) : '';

        if (custData.primaryAddress) {
            document.getElementById('customer-address-street').value = custData.primaryAddress.street || '';
            document.getElementById('customer-address-city').value = custData.primaryAddress.city || '';
            document.getElementById('customer-address-state').value = custData.primaryAddress.state || '';
            document.getElementById('customer-address-zipCode').value = custData.primaryAddress.zipCode || '';
            document.getElementById('customer-address-country').value = custData.primaryAddress.country || 'USA';
        }
        
        document.getElementById('customer-form-modal').style.display = 'block';
    }

    closeCustomerModal() {
        document.getElementById('customer-form-modal').style.display = 'none';
        this.editingCustomerData = null; // Clear temp data
    }

    async handleCustomerFormSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const errorDiv = document.getElementById('customer-form-error');
        const submitBtn = form.querySelector('button[type="submit"]');

        const customerData = {
            name: formData.get('name'),
            contactEmail: formData.get('contactEmail'),
            contactPhone: formData.get('contactPhone'),
            notes: formData.get('notes'),
            isActive: formData.get('isActive') === 'true',
            fuelSurchargeRate: formData.get('fuelSurchargeRate') ? parseFloat(formData.get('fuelSurchargeRate')) / 100 : 0,
            primaryAddress: {
                street: formData.get('primaryAddress.street'),
                city: formData.get('primaryAddress.city'),
                state: formData.get('primaryAddress.state'),
                zipCode: formData.get('primaryAddress.zipCode'),
                country: formData.get('primaryAddress.country')
            }
        };
        // Clean up empty address object if all fields are empty
        if (Object.values(customerData.primaryAddress).every(val => !val)) {
            delete customerData.primaryAddress;
        }


        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = this.editingCustomerId ? 'Saving...' : 'Creating...';

        try {
            let response;
            if (this.editingCustomerId) {
                response = await API.updateCustomer(this.editingCustomerId, customerData);
            } else {
                response = await API.createCustomer(customerData);
            }

            if (response && response.success) {
                alert(`Customer ${this.editingCustomerId ? 'updated' : 'created'} successfully!`);
                this.closeCustomerModal();
                this.loadCustomers(); // Refresh the list
            } else {
                throw new Error(response.message || `Failed to ${this.editingCustomerId ? 'update' : 'create'} customer.`);
            }
        } catch (error) {
            console.error('Customer form submission error:', error);
            errorDiv.textContent = error.message || 'An unknown error occurred.';
            errorDiv.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Customer';
            this.editingCustomerId = null; // Clear editing ID
        }
    }
    
    async handleDeleteCustomer(customerId, customerName) { // Soft delete (deactivate)
        if (!customerId) {
            alert('Customer ID is missing.');
            return;
        }
        if (confirm(`Are you sure you want to deactivate customer "${customerName || customerId}"? They will be hidden from lists but not permanently deleted.`)) {
            try {
                const response = await API.deleteCustomer(customerId); // This API call should perform a soft delete (isActive: false)
                if (response && response.success) {
                    alert('Customer deactivated successfully!');
                    this.loadCustomers(); // Refresh the list
                } else {
                    throw new Error(response.message || 'Failed to deactivate customer.');
                }
            } catch (error) {
                console.error('Failed to deactivate customer:', error);
                alert(`Error deactivating customer: ${error.message}`);
            }
        }
    }
}

// Initialize the page logic when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Auth === 'undefined') {
        console.error('Auth class is not defined. Make sure auth.js is loaded before customers.js');
        alert('Critical application error. Please try reloading.');
        window.location.href = 'index.html';
        return;
    }
    window.customersPage = new CustomersPage();
});