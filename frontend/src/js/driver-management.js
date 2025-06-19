// User Management Page Logic
class UserManagementPage {
    constructor() {
        this.users = [];
        this.currentUser = null;
        this.editingUserId = null;
        this.init();
    }

    init() {
        if (!Auth.isLoggedIn()) {
            window.location.href = 'index.html';
            return;
        }
        this.currentUser = Auth.getCurrentUser();
        // TODO: Add check here: if currentUser is not admin/manager, redirect or show error,
        // as only admins/managers should access user management.
        // For now, assuming the logged-in user has rights.
        this.updateUserInfo();
        this.bindEventListeners();
        this.loadUsers();
    }

    updateUserInfo() {
        const userNameSpan = document.getElementById('user-name-drivermgt'); // Corrected ID
        if (userNameSpan && this.currentUser) {
            userNameSpan.textContent = `Welcome, ${this.currentUser.fullName || this.currentUser.firstName || this.currentUser.username}`;
        }
    }

    bindEventListeners() {
        const logoutBtn = document.getElementById('logout-btn-drivermgt'); // Corrected ID
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        const backToDashboardBtn = document.getElementById('back-to-dashboard-btn-drivermgt'); // Corrected ID
        if (backToDashboardBtn) {
            backToDashboardBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        const showAddUserModalBtn = document.getElementById('show-add-user-modal-btn');
        if (showAddUserModalBtn) {
            showAddUserModalBtn.addEventListener('click', this.openCreateUserModal.bind(this));
        }

        const closeUserModalBtn = document.getElementById('close-user-modal-btn');
        if (closeUserModalBtn) {
            closeUserModalBtn.addEventListener('click', this.closeUserModal.bind(this));
        }

        const userForm = document.getElementById('user-form');
        if (userForm) {
            userForm.addEventListener('submit', this.handleUserFormSubmit.bind(this));
        }
        
        const userRoleSelect = document.getElementById('user-role');
        if(userRoleSelect) {
            userRoleSelect.addEventListener('change', this.toggleCommissionRateField.bind(this));
        }

        const userModal = document.getElementById('user-form-modal');
        if (userModal) {
            window.addEventListener('click', (event) => {
                if (event.target === userModal) {
                    this.closeUserModal();
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

    async loadUsers() {
        const loadingMsg = document.getElementById('loading-users-msg');
        const tableContainer = document.getElementById('users-table-container');
        
        if (loadingMsg) loadingMsg.style.display = 'block';
        if (tableContainer) tableContainer.innerHTML = '';

        try {
            // We need an API.getUsers() method
            const response = await API.getUsers(); // Assuming this endpoint exists
            if (response && Array.isArray(response.data)) {
                this.users = response.data;
            } else {
                console.error('Unexpected response structure for users:', response);
                this.users = [];
            }
            if (loadingMsg) loadingMsg.style.display = 'none';
            this.renderUsersTable();
        } catch (error) {
            console.error('Failed to load users:', error);
            if (loadingMsg) loadingMsg.style.display = 'none';
            if (tableContainer) tableContainer.innerHTML = '<p class="error-message">Error loading users. Please try again later.</p>';
            this.users = [];
            this.renderUsersTable();
        }
    }

    renderUsersTable() {
        const tableContainer = document.getElementById('users-table-container');
        if (!tableContainer) return;

        if (!this.users || this.users.length === 0) {
            tableContainer.innerHTML = '<p>No users found.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Active</th>
                    <th>Commission Rate</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;

        const tbody = table.querySelector('tbody');
        this.users.forEach(user => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${user.username || 'N/A'}</td>
                <td>${user.fullName || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'N/A')}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.role || 'N/A'}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>${user.isActive ? 'Yes' : 'No'}</td>
                <td>${user.role === 'driver' && user.commissionRate != null ? (user.commissionRate * 100).toFixed(0) + '%' : 'N/A'}</td>
                <td>
                    <button class="btn-action btn-edit btn-edit-user" data-id="${user._id}">Edit</button>
                    <button class="btn-action btn-delete btn-delete-user" data-id="${user._id}" data-username="${user.username}">Delete</button>
                </td>
            `;
            row.querySelector('.btn-edit-user').addEventListener('click', (e) => this.openEditUserModal(e.target.dataset.id));
            row.querySelector('.btn-delete-user').addEventListener('click', (e) => this.handleDeleteUser(e.target.dataset.id, e.target.dataset.username));
        });

        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    openCreateUserModal() {
        this.editingUserId = null;
        document.getElementById('user-form-title').textContent = 'Add New User';
        document.getElementById('user-form').reset();
        document.getElementById('user-password-group').style.display = 'block';
        document.getElementById('user-password').required = true;
        this.toggleCommissionRateField({ target: document.getElementById('user-role') }); // Set initial visibility
        document.getElementById('user-form-modal').style.display = 'block';
    }

    async openEditUserModal(userId) {
        this.editingUserId = userId;
        // We might need API.getUserById(userId) if not all details are in the list
        const user = this.users.find(u => u._id === userId); 
        if (!user) {
            alert('Error: User not found for editing.');
            return;
        }

        document.getElementById('user-form-title').textContent = 'Edit User';
        const form = document.getElementById('user-form');
        form.reset();

        document.getElementById('user-edit-id').value = user._id;
        document.getElementById('user-username').value = user.username || '';
        document.getElementById('user-email').value = user.email || '';
        document.getElementById('user-firstName').value = user.firstName || '';
        document.getElementById('user-lastName').value = user.lastName || '';
        document.getElementById('user-phone').value = user.phone || '';
        document.getElementById('user-role').value = user.role || 'driver';
        document.getElementById('user-isActive').value = user.isActive ? 'true' : 'false';
        
        document.getElementById('user-password-group').style.display = 'block'; // Or 'none' if password change is separate
        document.getElementById('user-password').required = false; // Not required when editing
        document.getElementById('user-password').placeholder = 'Leave blank to keep current password';


        const commissionRateField = document.getElementById('user-commissionRate');
        if (user.role === 'driver') {
            commissionRateField.value = user.commissionRate != null ? user.commissionRate : '';
            document.getElementById('user-commissionRate-group').style.display = 'block';
        } else {
            commissionRateField.value = '';
            document.getElementById('user-commissionRate-group').style.display = 'none';
        }
        
        this.toggleCommissionRateField({ target: document.getElementById('user-role') });
        document.getElementById('user-form-modal').style.display = 'block';
    }

    closeUserModal() {
        document.getElementById('user-form-modal').style.display = 'none';
    }
    
    toggleCommissionRateField(event) {
        const role = event.target.value;
        const commissionRateGroup = document.getElementById('user-commissionRate-group');
        const commissionRateInput = document.getElementById('user-commissionRate');
        if (role === 'driver') {
            commissionRateGroup.style.display = 'block';
            commissionRateInput.required = true;
        } else {
            commissionRateGroup.style.display = 'none';
            commissionRateInput.required = false;
            commissionRateInput.value = ''; // Clear it if not a driver
        }
    }

    async handleUserFormSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const errorDiv = document.getElementById('user-form-error');
        const submitBtn = form.querySelector('button[type="submit"]');

        const userData = {
            username: formData.get('username'),
            email: formData.get('email'),
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            phone: formData.get('phone'),
            role: formData.get('role'),
            isActive: formData.get('isActive') === 'true'
        };

        if (formData.get('password')) {
            userData.password = formData.get('password');
        }

        if (userData.role === 'driver') {
            userData.commissionRate = parseFloat(formData.get('commissionRate'));
            if (isNaN(userData.commissionRate)) {
                 errorDiv.textContent = 'Commission rate must be a number.';
                 errorDiv.style.display = 'block';
                 return;
            }
        } else {
            delete userData.commissionRate; // Ensure it's not sent if role is not driver
        }

        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = this.editingUserId ? 'Saving...' : 'Creating...';

        try {
            let response;
            if (this.editingUserId) {
                // Need API.updateUser(id, data)
                response = await API.updateUser(this.editingUserId, userData);
            } else {
                // Uses /api/auth/register for creation
                response = await API.makeRequest('/auth/register', { 
                    method: 'POST', 
                    body: JSON.stringify(userData) 
                });
            }

            if (response && response.success) {
                alert(`User ${this.editingUserId ? 'updated' : 'created'} successfully!`);
                this.closeUserModal();
                this.loadUsers(); // Refresh the list
            } else {
                throw new Error(response.message || `Failed to ${this.editingUserId ? 'update' : 'create'} user.`);
            }
        } catch (error) {
            console.error('User form submission error:', error);
            errorDiv.textContent = error.message || 'An unknown error occurred.';
            errorDiv.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save User';
        }
    }
    
    async handleDeleteUser(userId, username) {
        if (!userId) {
            alert('User ID is missing.');
            return;
        }
        // Prevent deleting the currently logged-in user (important safeguard)
        if (this.currentUser && this.currentUser.id === userId) {
            alert("You cannot delete your own account.");
            return;
        }

        if (confirm(`Are you sure you want to delete user "${username || userId}"? This action cannot be undone.`)) {
            try {
                // Need API.deleteUser(id)
                const response = await API.deleteUser(userId);
                if (response && response.success) {
                    alert('User deleted successfully!');
                    this.loadUsers(); // Refresh the list
                } else {
                    throw new Error(response.message || 'Failed to delete user.');
                }
            } catch (error) {
                console.error('Failed to delete user:', error);
                alert(`Error deleting user: ${error.message}`);
            }
        }
    }
}

// Initialize the page logic when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Auth === 'undefined') {
        console.error('Auth class is not defined. Make sure auth.js is loaded before user-management.js');
        alert('Critical application error. Please try reloading.');
        window.location.href = 'index.html';
        return;
    }
    window.userManagementPage = new UserManagementPage();
});