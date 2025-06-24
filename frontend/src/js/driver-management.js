// Driver Management Page Logic (Refactored from UserManagementPage)
class DriverManagementPage {
    constructor() {
        this.drivers = []; // Changed from this.users
        this.currentUser = null;
        this.editingDriverId = null; // Changed from this.editingUserId
        this.init();
    }

    init() {
        if (!Auth.isLoggedIn()) {
            window.location.href = 'index.html';
            return;
        }
        this.currentUser = Auth.getCurrentUser();
        // TODO: Add permission check for managing drivers
        this.updateUserInfo();
        this.bindEventListeners();
        this.loadDrivers(); // Changed from loadUsers
    }

    updateUserInfo() {
        const userNameSpan = document.getElementById('user-name-drivermgt');
        if (userNameSpan && this.currentUser) {
            userNameSpan.textContent = `Welcome, ${this.currentUser.fullName || this.currentUser.firstName || this.currentUser.username}`;
        }
    }

    bindEventListeners() {
        const logoutBtn = document.getElementById('logout-btn-drivermgt');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        const backToDashboardBtn = document.getElementById('back-to-dashboard-btn-drivermgt');
        if (backToDashboardBtn) {
            backToDashboardBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        // Updated IDs to match HTML changes
        const showAddDriverModalBtn = document.getElementById('show-add-driver-modal-btn');
        if (showAddDriverModalBtn) {
            showAddDriverModalBtn.addEventListener('click', this.openCreateDriverModal.bind(this));
        }

        const closeDriverModalBtn = document.getElementById('close-driver-modal-btn');
        if (closeDriverModalBtn) {
            closeDriverModalBtn.addEventListener('click', this.closeDriverModal.bind(this));
        }

        const driverForm = document.getElementById('driver-form');
        if (driverForm) {
            driverForm.addEventListener('submit', this.handleDriverFormSubmit.bind(this));
        }
        
        // Removed userRoleSelect listener and toggleCommissionRateField as commission rate is always relevant for Drivers

        const driverModal = document.getElementById('driver-form-modal');
        if (driverModal) {
            window.addEventListener('click', (event) => {
                if (event.target === driverModal) {
                    this.closeDriverModal();
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

    async loadDrivers() { // Renamed from loadUsers
        const loadingMsg = document.getElementById('loading-drivers-msg'); // Updated ID
        const tableContainer = document.getElementById('drivers-table-container'); // Updated ID
        
        if (loadingMsg) loadingMsg.style.display = 'block';
        if (tableContainer) tableContainer.innerHTML = '';

        try {
            const response = await API.getDrivers(); // Use new API method
            if (response && Array.isArray(response.data)) {
                this.drivers = response.data; // Store in this.drivers
            } else {
                console.error('Unexpected response structure for drivers:', response);
                this.drivers = [];
            }
            if (loadingMsg) loadingMsg.style.display = 'none';
            this.renderDriversTable(); // Call new render method
        } catch (error) {
            console.error('Failed to load drivers:', error);
            if (loadingMsg) loadingMsg.style.display = 'none';
            if (tableContainer) tableContainer.innerHTML = '<p class="error-message">Error loading drivers. Please try again later.</p>';
            this.drivers = [];
            this.renderDriversTable();
        }
    }

    renderDriversTable() { // Renamed from renderUsersTable
        const tableContainer = document.getElementById('drivers-table-container'); // Updated ID
        if (!tableContainer) return;

        if (!this.drivers || this.drivers.length === 0) {
            tableContainer.innerHTML = '<p>No drivers found.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Full Name</th>
                    <th>Contact Phone</th>
                    <th>Contact Email</th>
                    <th>Commission Rate</th>
                    <th>Active</th>
                    <th>Notes</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;

        const tbody = table.querySelector('tbody');
        this.drivers.forEach(driver => { // Iterate this.drivers
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${driver.fullName || (driver.firstName && driver.lastName ? `${driver.firstName} ${driver.lastName}` : 'N/A')}</td>
                <td>${driver.contactPhone || 'N/A'}</td>
                <td>${driver.contactEmail || 'N/A'}</td>
                <td>${driver.commissionRate != null ? (driver.commissionRate * 100).toFixed(1) + '%' : 'N/A'}</td>
                <td>${driver.isActive ? 'Yes' : 'No'}</td>
                <td>${driver.notes || ''}</td>
                <td>
                    <button class="btn-action btn-edit btn-edit-driver" data-id="${driver._id}">Edit</button>
                    <button class="btn-action btn-delete btn-delete-driver" data-id="${driver._id}" data-name="${driver.fullName || `${driver.firstName} ${driver.lastName}`}">Deactivate</button>
                </td>
            `;
            row.querySelector('.btn-edit-driver').addEventListener('click', (e) => this.openEditDriverModal(e.target.dataset.id));
            row.querySelector('.btn-delete-driver').addEventListener('click', (e) => this.handleDeleteDriver(e.target.dataset.id, e.target.dataset.name));
        });

        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    openCreateDriverModal() { // Renamed from openCreateUserModal
        this.editingDriverId = null; // Changed from editingUserId
        document.getElementById('driver-form-title').textContent = 'Add New Driver'; // Updated ID
        document.getElementById('driver-form').reset(); // Updated ID
        document.getElementById('driver-isActive').value = 'true'; // Default to active
        document.getElementById('driver-commissionRate').value = '0.10'; // Default commission rate e.g. 0.10 for 10%
        document.getElementById('driver-form-modal').style.display = 'block'; // Updated ID
    }

    async openEditDriverModal(driverId) { // Renamed from openEditUserModal
        this.editingDriverId = driverId; // Changed from editingUserId
        
        const driver = this.drivers.find(d => d._id === driverId);
        if (!driver) {
            // Attempt to fetch fresh if not in list (e.g., after direct navigation or if list is paged)
            try {
                const response = await API.getDriverById(driverId);
                if (response && response.data) {
                    this.editingDriverData = response.data;
                } else {
                    alert('Error: Driver not found for editing.');
                    return;
                }
            } catch (error) {
                 alert('Error fetching driver details for editing.');
                 console.error("Error fetching driver for edit:", error);
                 return;
            }
        } else {
            this.editingDriverData = driver;
        }
        
        const driverData = this.editingDriverData;

        document.getElementById('driver-form-title').textContent = 'Edit Driver'; // Updated ID
        const form = document.getElementById('driver-form'); // Updated ID
        form.reset();

        document.getElementById('driver-edit-id').value = driverData._id; // Updated ID
        document.getElementById('driver-firstName').value = driverData.firstName || ''; // Updated ID
        document.getElementById('driver-lastName').value = driverData.lastName || ''; // Updated ID
        document.getElementById('driver-contactPhone').value = driverData.contactPhone || ''; // Updated ID
        document.getElementById('driver-contactEmail').value = driverData.contactEmail || ''; // Updated ID
        document.getElementById('driver-commissionRate').value = driverData.commissionRate != null ? driverData.commissionRate : ''; // Expects decimal
        document.getElementById('driver-notes').value = driverData.notes || ''; // Added notes
        document.getElementById('driver-isActive').value = driverData.isActive ? 'true' : 'false'; // Updated ID
        
        document.getElementById('driver-form-modal').style.display = 'block'; // Updated ID
    }

    closeDriverModal() { // Renamed from closeUserModal
        document.getElementById('driver-form-modal').style.display = 'none'; // Updated ID
        this.editingDriverData = null;
    }
    
    // toggleCommissionRateField removed as it's no longer needed for Driver entity

    async handleDriverFormSubmit(event) { // Renamed from handleUserFormSubmit
        event.preventDefault();
        const form = event.target; // Should be driver-form
        const formData = new FormData(form);
        const errorDiv = document.getElementById('driver-form-error'); // Updated ID
        const submitBtn = form.querySelector('button[type="submit"]');

        const driverData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            contactPhone: formData.get('contactPhone'),
            contactEmail: formData.get('contactEmail'),
            commissionRate: parseFloat(formData.get('commissionRate')), // Ensure it's a number
            notes: formData.get('notes'),
            isActive: formData.get('isActive') === 'true'
        };

        if (isNaN(driverData.commissionRate) || driverData.commissionRate < 0 || driverData.commissionRate > 1) {
             errorDiv.textContent = 'Commission rate must be a number between 0 and 1 (e.g., 0.1 for 10%).';
             errorDiv.style.display = 'block';
             return;
        }

        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = this.editingDriverId ? 'Saving...' : 'Creating...';

        try {
            let response;
            if (this.editingDriverId) {
                response = await API.updateDriver(this.editingDriverId, driverData);
            } else {
                response = await API.createDriver(driverData);
            }

            if (response && response.success) {
                alert(`Driver ${this.editingDriverId ? 'updated' : 'created'} successfully!`);
                this.closeDriverModal();
                this.loadDrivers(); // Refresh the list
            } else {
                throw new Error(response.message || `Failed to ${this.editingDriverId ? 'update' : 'create'} driver.`);
            }
        } catch (error) {
            console.error('Driver form submission error:', error);
            errorDiv.textContent = error.message || 'An unknown error occurred.';
            errorDiv.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Driver';
            this.editingDriverId = null;
        }
    }
    
    async handleDeleteDriver(driverId, driverName) { // Renamed from handleDeleteUser
        if (!driverId) {
            alert('Driver ID is missing.');
            return;
        }
      
        if (confirm(`Are you sure you want to deactivate driver "${driverName || driverId}"?`)) {
            try {
                const response = await API.deleteDriver(driverId); // Calls soft delete
                if (response && response.success) {
                    alert('Driver deactivated successfully!');
                    this.loadDrivers(); // Refresh the list
                } else {
                    throw new Error(response.message || 'Failed to deactivate driver.');
                }
            } catch (error) {
                console.error('Failed to deactivate driver:', error);
                alert(`Error deactivating driver: ${error.message}`);
            }
        }
    }
}

// Initialize the page logic when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Auth === 'undefined') {
        console.error('Auth class is not defined. Make sure auth.js is loaded before driver-management.js');
        alert('Critical application error. Please try reloading.');
        window.location.href = 'index.html';
        return;
    }
    window.driverManagementPage = new DriverManagementPage(); // Changed class name
});