// Shipments Page Logic
class ShipmentsPage {
    constructor() {
        this.shipments = [];
        this.drivers = []; // To store drivers for the dropdown
        this.editingShipmentId = null; // To store the ID of the shipment being edited
        this.init();
    }

    init() {
        // Check auth status first, redirect if not logged in
        if (!Auth.isLoggedIn()) {
            window.location.href = 'index.html'; // Redirect to login
            return;
        }
        this.currentUser = Auth.getCurrentUser();
        this.updateUserInfo();
        this.bindEventListeners();
        // Ensure drivers are loaded before attempting to load and render shipments
        // as renderShipmentsTable depends on this.drivers
        this.loadInitialData();
    }

    async loadInitialData() {
        await this.loadDrivers(); // Wait for drivers to be loaded
        await this.loadShipments(); // Then load shipments
    }

    updateUserInfo() {
        const userNameSpan = document.getElementById('user-name-shipments');
        if (userNameSpan && this.currentUser) {
            userNameSpan.textContent = `Welcome, ${this.currentUser.fullName || this.currentUser.firstName || this.currentUser.username}`;
        }
    }

    bindEventListeners() {
        const logoutBtn = document.getElementById('logout-btn-shipments');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
        if (backToDashboardBtn) {
            backToDashboardBtn.addEventListener('click', () => {
                window.location.href = 'index.html'; // Assuming dashboard is on index.html after login
            });
        }

        const showAddShipmentFormBtn = document.getElementById('show-add-shipment-form-btn');
        if (showAddShipmentFormBtn) {
            showAddShipmentFormBtn.addEventListener('click', this.showAddShipmentForm.bind(this));
        }

        const shipmentForm = document.getElementById('shipment-form');
        if (shipmentForm) {
            shipmentForm.addEventListener('submit', this.handleShipmentFormSubmit.bind(this));
        }

        const cancelShipmentFormBtn = document.getElementById('cancel-shipment-form-btn');
        if (cancelShipmentFormBtn) {
            cancelShipmentFormBtn.addEventListener('click', this.hideShipmentForm.bind(this));
        }
        
        const addItemBtn = document.getElementById('add-item-btn');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', this.addItemToForm.bind(this));
        }
    }

    async handleLogout() {
        try {
            await Auth.logout();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Logout failed. Please try again.');
            // Still attempt to redirect
            window.location.href = 'index.html';
        }
    }

    showAddShipmentForm() {
        this.editingShipmentId = null; // Clear any editing ID
        document.getElementById('shipment-form-title').textContent = 'Add New Shipment';
        document.getElementById('shipment-form').reset();
        this.clearItemsFromForm(); // Clear any dynamically added items
        document.getElementById('shipment-db-id').value = ''; // Clear hidden DB ID
        document.getElementById('shipment-form-section').style.display = 'block';
        document.getElementById('shipments-list-section').style.display = 'none';
    }

    hideShipmentForm() {
        document.getElementById('shipment-form-section').style.display = 'none';
        document.getElementById('shipments-list-section').style.display = 'block';
        document.getElementById('shipment-form').reset();
        this.clearItemsFromForm();
        document.getElementById('shipment-form-error').style.display = 'none';
        this.editingShipmentId = null;
    }

    async loadShipments() {
        const loadingMsg = document.getElementById('loading-shipments-msg');
        const tableContainer = document.getElementById('shipments-table-container');
        
        if (loadingMsg) loadingMsg.style.display = 'block';
        if (tableContainer) tableContainer.innerHTML = ''; // Clear previous table

        try {
            const response = await API.getShipments();
            if (response && Array.isArray(response.data)) {
                this.shipments = response.data;
            } else if (response && Array.isArray(response.shipments)) {
                 this.shipments = response.shipments;
            } else if (Array.isArray(response)) {
                this.shipments = response;
            } else {
                console.error('Unexpected response structure for shipments:', response);
                this.shipments = [];
            }
            
            if (loadingMsg) loadingMsg.style.display = 'none';
            
            // Ensure drivers are loaded before rendering.
            // this.drivers should be populated by loadInitialData -> loadDrivers
            if (!this.drivers) { // Or check if it's an empty array if it's initialized as such
                console.warn('Drivers not yet loaded, deferring shipment table render or showing placeholder names.');
                // Optionally, you could try to load drivers again here or show a loading state for driver names
            }
            this.renderShipmentsTable();
        } catch (error) {
            console.error('Failed to load shipments:', error);
            if (loadingMsg) loadingMsg.style.display = 'none';
            if (tableContainer) tableContainer.innerHTML = '<p class="error-message">Error loading shipments. Please try again later.</p>';
            // Also ensure this.shipments is an array in case of error before render
            this.shipments = [];
            this.renderShipmentsTable(); // Attempt to render (will show "no shipments")
        }
    }

    renderShipmentsTable() {
        const tableContainer = document.getElementById('shipments-table-container');
        if (!tableContainer) return;

        if (!this.shipments || this.shipments.length === 0) {
            tableContainer.innerHTML = '<p>No shipments found. Click "Add New Shipment" to create one.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Shipment ID</th>
                    <th>Origin</th>
                    <th>Destination</th>
                    <th>Pickup Date</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Driver</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;

        const tbody = table.querySelector('tbody');
        this.shipments.forEach(shipment => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${shipment.shipmentId || 'N/A'}</td>
                <td>${shipment.origin ? `${shipment.origin.city}, ${shipment.origin.state}` : 'N/A'}</td>
                <td>${shipment.destination ? `${shipment.destination.city}, ${shipment.destination.state}` : 'N/A'}</td>
                <td>${shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : 'N/A'}</td>
                <td>${shipment.customer ? shipment.customer.name : 'N/A'}</td>
                <td><span class="status-badge status-${shipment.status || 'unknown'}">${shipment.status || 'N/A'}</span></td>
                <td>${shipment.driver ? (this.drivers.find(d => d._id === shipment.driver)?.name || 'N/A') : 'Not Assigned'}</td>
                <td>
                    <button class="btn-action btn-edit" data-id="${shipment._id}">Edit</button>
                    <button class="btn-action btn-delete" data-id="${shipment._id}">Delete</button>
                    <button class="btn-action btn-details" data-id="${shipment._id}">Details</button>
                </td>
            `;
            // Add event listeners for action buttons
            row.querySelector('.btn-edit').addEventListener('click', (e) => this.showEditShipmentForm(e.target.dataset.id));
            row.querySelector('.btn-delete').addEventListener('click', (e) => this.handleDeleteShipment(e.target.dataset.id));
            row.querySelector('.btn-details').addEventListener('click', (e) => this.showShipmentDetails(e.target.dataset.id));
        });

        tableContainer.innerHTML = ''; // Clear loading/empty message
        tableContainer.appendChild(table);
    }
    
    async loadDrivers() {
        try {
            // Assuming an API.getDrivers() method exists or will be created
            // For now, using a placeholder or ensuring it's handled if API.js has it
            if (API.getDrivers) {
                 const driverResponse = await API.getDrivers();
                 // Assuming drivers are in driverResponse.data or driverResponse.drivers
                 if (driverResponse && Array.isArray(driverResponse.data)) {
                    this.drivers = driverResponse.data;
                 } else if (driverResponse && Array.isArray(driverResponse.drivers)) {
                    this.drivers = driverResponse.drivers;
                 } else if (Array.isArray(driverResponse)) {
                    this.drivers = driverResponse;
                 }
                 else {
                    console.error('Unexpected response structure for drivers:', driverResponse);
                    this.drivers = [];
                 }
                 this.populateDriverDropdown();
            } else {
                console.warn("API.getDrivers() method not found. Driver dropdown will be empty.");
                this.drivers = [];
                this.populateDriverDropdown();
            }
        } catch (error) {
            console.error('Failed to load drivers:', error);
            this.drivers = [];
            this.populateDriverDropdown();
        }
    }

    populateDriverDropdown() {
        const driverSelect = document.getElementById('driver');
        if (!driverSelect) return;

        driverSelect.innerHTML = '<option value="">-- Select Driver --</option>'; // Default option
        if (this.drivers && this.drivers.length > 0) {
            this.drivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver._id; // Assuming driver object has _id and name
                option.textContent = driver.name;
                driverSelect.appendChild(option);
            });
        }
    }

    addItemToForm() {
        const itemsContainer = document.getElementById('items-container');
        if (!itemsContainer) return;

        const itemIndex = itemsContainer.children.length;
        const newItemEntry = document.createElement('div');
        newItemEntry.className = 'item-entry';
        newItemEntry.innerHTML = `
            <fieldset>
                <legend>Item ${itemIndex + 1}</legend>
                <div class="form-group">
                    <label for="item-description-${itemIndex}">Description:</label>
                    <input type="text" id="item-description-${itemIndex}" name="items[${itemIndex}][description]" required>
                </div>
                <div class="form-group">
                    <label for="item-quantity-${itemIndex}">Quantity:</label>
                    <input type="number" id="item-quantity-${itemIndex}" name="items[${itemIndex}][quantity]" min="1" value="1" required>
                </div>
                <div class="form-group">
                    <label for="item-weight-${itemIndex}">Weight (lbs, optional):</label>
                    <input type="number" id="item-weight-${itemIndex}" name="items[${itemIndex}][weight]" min="0">
                </div>
                <button type="button" class="btn-remove-item btn-secondary">Remove Item</button>
            </fieldset>
        `;
        newItemEntry.querySelector('.btn-remove-item').addEventListener('click', () => newItemEntry.remove());
        itemsContainer.appendChild(newItemEntry);
    }

    clearItemsFromForm() {
        const itemsContainer = document.getElementById('items-container');
        if (itemsContainer) {
            itemsContainer.innerHTML = ''; // Remove all item entries
        }
    }
    
    collectFormData() {
        const form = document.getElementById('shipment-form');
        const formData = new FormData(form);
        const data = {};

        // Basic fields
        data.shipmentId = formData.get('shipmentId');
        data.pickupDate = formData.get('pickupDate');
        data.status = formData.get('status');
        data.driver = formData.get('driver') || null; // Handle empty driver selection

        // Nested objects
        data.origin = {
            street: formData.get('origin.street'),
            city: formData.get('origin.city'),
            state: formData.get('origin.state'),
            zipCode: formData.get('origin.zipCode'),
        };
        data.destination = {
            street: formData.get('destination.street'),
            city: formData.get('destination.city'),
            state: formData.get('destination.state'),
            zipCode: formData.get('destination.zipCode'),
        };
        data.customer = {
            name: formData.get('customer.name'),
            contact: formData.get('customer.contact'),
        };

        // Items - this needs careful handling due to dynamic nature
        data.items = [];
        const itemEntries = form.querySelectorAll('.item-entry');
        itemEntries.forEach((itemEntry, index) => {
            const item = {
                description: itemEntry.querySelector(`input[name="items[${index}][description]"]`).value,
                quantity: parseInt(itemEntry.querySelector(`input[name="items[${index}][quantity]"]`).value, 10),
                weight: parseFloat(itemEntry.querySelector(`input[name="items[${index}][weight]"]`).value) || null,
            };
            if (item.description && item.quantity) { // Basic validation for item
                 data.items.push(item);
            }
        });
        
        // If no items were added, ensure items is an empty array or handle as per backend requirements
        if (data.items.length === 0) {
            // Depending on backend:
            // delete data.items; // or
            // data.items = []; // (already done)
        }


        // Include the database ID if we are editing
        const dbId = document.getElementById('shipment-db-id').value;
        if (dbId) {
            data._id = dbId; // Or however the backend expects the ID for updates
        }
        
        return data;
    }

    async handleShipmentFormSubmit(event) {
        event.preventDefault();
        const shipmentData = this.collectFormData();
        const errorDiv = document.getElementById('shipment-form-error');
        const submitBtn = event.target.querySelector('button[type="submit"]');

        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = this.editingShipmentId ? 'Saving...' : 'Creating...';

        try {
            if (this.editingShipmentId) {
                // Update existing shipment
                await API.updateShipment(this.editingShipmentId, shipmentData);
                alert('Shipment updated successfully!');
            } else {
                // Create new shipment
                await API.createShipment(shipmentData);
                alert('Shipment created successfully!');
            }
            this.hideShipmentForm();
            this.loadShipments(); // Refresh the list
        } catch (error) {
            console.error('Shipment form submission error:', error);
            errorDiv.textContent = error.message || 'Failed to save shipment. Please check the details and try again.';
            errorDiv.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Shipment';
        }
    }

    async showEditShipmentForm(shipmentDbId) {
        this.editingShipmentId = shipmentDbId;
        const shipment = this.shipments.find(s => s._id === shipmentDbId);
        if (!shipment) {
            alert('Error: Shipment not found for editing.');
            return;
        }

        document.getElementById('shipment-form-title').textContent = 'Edit Shipment';
        const form = document.getElementById('shipment-form');
        form.reset(); // Clear previous data
        this.clearItemsFromForm();

        // Populate form fields
        document.getElementById('shipment-db-id').value = shipment._id;
        document.getElementById('shipmentId').value = shipment.shipmentId || '';
        
        if (shipment.origin) {
            document.getElementById('origin-street').value = shipment.origin.street || '';
            document.getElementById('origin-city').value = shipment.origin.city || '';
            document.getElementById('origin-state').value = shipment.origin.state || '';
            document.getElementById('origin-zipCode').value = shipment.origin.zipCode || '';
        }
        if (shipment.destination) {
            document.getElementById('destination-street').value = shipment.destination.street || '';
            document.getElementById('destination-city').value = shipment.destination.city || '';
            document.getElementById('destination-state').value = shipment.destination.state || '';
            document.getElementById('destination-zipCode').value = shipment.destination.zipCode || '';
        }
        if (shipment.pickupDate) {
            // Format date to YYYY-MM-DD for input type="date"
            const date = new Date(shipment.pickupDate);
            const year = date.getFullYear();
            const month = ('0' + (date.getMonth() + 1)).slice(-2);
            const day = ('0' + date.getDate()).slice(-2);
            document.getElementById('pickupDate').value = `${year}-${month}-${day}`;
        }
        if (shipment.customer) {
            document.getElementById('customer-name').value = shipment.customer.name || '';
            document.getElementById('customer-contact').value = shipment.customer.contact || '';
        }
        document.getElementById('status').value = shipment.status || 'pending';
        document.getElementById('driver').value = shipment.driver || '';

        // Populate items
        if (shipment.items && shipment.items.length > 0) {
            shipment.items.forEach(item => {
                this.addItemToFormWithData(item);
            });
        }

        document.getElementById('shipment-form-section').style.display = 'block';
        document.getElementById('shipments-list-section').style.display = 'none';
    } // <-- This was the missing closing brace for showEditShipmentForm

    addItemToFormWithData(itemData) {
        const itemsContainer = document.getElementById('items-container');
        if (!itemsContainer) return;

        const itemIndex = itemsContainer.children.length;
        const newItemEntry = document.createElement('div');
        newItemEntry.className = 'item-entry';
        newItemEntry.innerHTML = `
            <fieldset>
                <legend>Item ${itemIndex + 1}</legend>
                <div class="form-group">
                    <label for="item-description-${itemIndex}">Description:</label>
                    <input type="text" id="item-description-${itemIndex}" name="items[${itemIndex}][description]" value="${itemData.description || ''}" required>
                </div>
                <div class="form-group">
                    <label for="item-quantity-${itemIndex}">Quantity:</label>
                    <input type="number" id="item-quantity-${itemIndex}" name="items[${itemIndex}][quantity]" value="${itemData.quantity || 1}" min="1" required>
                </div>
                <div class="form-group">
                    <label for="item-weight-${itemIndex}">Weight (lbs, optional):</label>
                    <input type="number" id="item-weight-${itemIndex}" name="items[${itemIndex}][weight]" value="${itemData.weight || ''}" min="0">
                </div>
                <button type="button" class="btn-remove-item btn-secondary">Remove Item</button>
            </fieldset>
        `;
        newItemEntry.querySelector('.btn-remove-item').addEventListener('click', () => newItemEntry.remove());
        itemsContainer.appendChild(newItemEntry);
    }


    async handleDeleteShipment(shipmentDbId) {
        const shipment = this.shipments.find(s => s._id === shipmentDbId);
        if (!shipment) {
            alert('Error: Shipment not found for deletion.');
            return;
        }

        if (confirm(`Are you sure you want to delete shipment ${shipment.shipmentId || shipmentDbId}? This action cannot be undone.`)) {
            try {
                await API.deleteShipment(shipmentDbId);
                alert('Shipment deleted successfully!');
                this.loadShipments(); // Refresh the list
            } catch (error) {
                console.error('Failed to delete shipment:', error);
                alert(`Error deleting shipment: ${error.message || 'Unknown error'}`);
            }
        }
    }

    async showShipmentDetails(shipmentDbId) {
        // This could open a modal or a dedicated details view.
        // For now, let's just log to console or alert.
        try {
            const shipment = await API.getShipmentById(shipmentDbId); // Fetch fresh details
            if (shipment) {
                let details = `Shipment Details:\n`;
                details += `DB ID: ${shipment._id}\n`;
                details += `Shipment ID: ${shipment.shipmentId}\n`;
                details += `Status: ${shipment.status}\n`;
                details += `Pickup Date: ${new Date(shipment.pickupDate).toLocaleDateString()}\n`;
                details += `Origin: ${shipment.origin.street}, ${shipment.origin.city}, ${shipment.origin.state} ${shipment.origin.zipCode}\n`;
                details += `Destination: ${shipment.destination.street}, ${shipment.destination.city}, ${shipment.destination.state} ${shipment.destination.zipCode}\n`;
                details += `Customer: ${shipment.customer.name} (${shipment.customer.contact || 'No contact'})\n`;
                details += `Driver: ${shipment.driver ? (this.drivers.find(d => d._id === shipment.driver)?.name || 'Unknown Driver ID') : 'Not Assigned'}\n`;
                
                if (shipment.items && shipment.items.length > 0) {
                    details += `Items:\n`;
                    shipment.items.forEach((item, index) => {
                        details += `  Item ${index + 1}: ${item.description}, Qty: ${item.quantity}, Weight: ${item.weight || 'N/A'} lbs\n`;
                    });
                } else {
                    details += `Items: No items listed.\n`;
                }
                
                alert(details); // Replace with a proper modal display
            } else {
                alert('Shipment details not found.');
            }
        } catch (error) {
            console.error('Failed to load shipment details:', error);
            alert('Error loading shipment details.');
        }
    }
}

// Initialize the shipments page logic when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Ensure Auth class is available (it should be if auth.js is loaded before this script)
    if (typeof Auth === 'undefined') {
        console.error('Auth class is not defined. Make sure auth.js is loaded before shipments.js');
        // Potentially redirect to an error page or login page
        alert('Critical application error. Please try reloading. If the problem persists, contact support.');
        window.location.href = 'index.html'; // Fallback redirect
        return;
    }
    window.shipmentsPage = new ShipmentsPage();
});