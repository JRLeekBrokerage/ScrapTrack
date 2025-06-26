// Shipments Page Logic
class ShipmentsPage {
    constructor() {
        this.shipments = [];
        this.drivers = [];
        this.customers = [];
        this.editingShipmentId = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.limit = 20; // Default records per page
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
        this.loadInitialData();
    }

    async loadInitialData() {
        console.log('[shipments.js] Entering loadInitialData...');
        try {
            await this.loadDrivers();
            console.log('[shipments.js] loadDrivers completed.');
            await this.loadCustomers();
            console.log('[shipments.js] loadCustomers completed.');
            await this.loadShipments(); // Will load initial page (page 1)
            console.log('[shipments.js] loadShipments completed.');
        } catch (error) {
            console.error('[shipments.js] Error in loadInitialData:', error);
        }
    }

    updateUserInfo() {
        const userNameSpan = document.getElementById('user-name-shipments');
        if (userNameSpan && this.currentUser) {
            userNameSpan.textContent = `Welcome, ${this.currentUser.fullName || this.currentUser.firstName || this.currentUser.username}`;
        }
    }

    bindEventListeners() {
        const logoutBtn = document.getElementById('logout-btn-shipments');
        if (logoutBtn) logoutBtn.addEventListener('click', this.handleLogout.bind(this));

        const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
        if (backToDashboardBtn) backToDashboardBtn.addEventListener('click', () => { window.location.href = 'index.html'; });

        const showAddShipmentFormBtn = document.getElementById('show-add-shipment-form-btn');
        if (showAddShipmentFormBtn) showAddShipmentFormBtn.addEventListener('click', this.openShipmentFormModal.bind(this));

        const shipmentForm = document.getElementById('shipment-form');
        if (shipmentForm) shipmentForm.addEventListener('submit', this.handleShipmentFormSubmit.bind(this));

        const cancelShipmentFormBtn = document.getElementById('cancel-shipment-form-btn');
        if (cancelShipmentFormBtn) cancelShipmentFormBtn.addEventListener('click', this.closeShipmentFormModal.bind(this));
        
        const closeDetailsModalBtn = document.getElementById('close-shipment-details-modal-btn');
        if (closeDetailsModalBtn) closeDetailsModalBtn.addEventListener('click', this.closeShipmentDetailsModal.bind(this));
        
        const closeShipmentFormModalBtn = document.getElementById('close-shipment-form-modal-btn'); 
        if (closeShipmentFormModalBtn) closeShipmentFormModalBtn.addEventListener('click', this.closeShipmentFormModal.bind(this));

        const shipmentDetailsModal = document.getElementById('shipment-details-modal');
        if (shipmentDetailsModal) {
            window.addEventListener('click', (event) => {
                if (event.target === shipmentDetailsModal) this.closeShipmentDetailsModal();
            });
        }
        
        const shipmentFormModal = document.getElementById('shipment-form-modal'); 
        if (shipmentFormModal) {
            window.addEventListener('click', (event) => {
                if (event.target === shipmentFormModal) this.closeShipmentFormModal();
            });
        }
         // Event listeners for dynamic freight cost calculation
        const weightInput = document.getElementById('weight');
        const rateInput = document.getElementById('rate');
        if (weightInput) weightInput.addEventListener('input', () => this.updateCalculatedFreightCost());
        if (rateInput) rateInput.addEventListener('input', () => this.updateCalculatedFreightCost());
    }

    updateCalculatedFreightCost() {
        const weightInLbs = parseFloat(document.getElementById('weight').value) || 0;
        const ratePerTon = parseFloat(document.getElementById('rate').value) || 0; // Input is Dollars per Ton
        const MINIMUM_WEIGHT = 40000;
        
        let calculatedCost = 0;
        if (weightInLbs > 0 && ratePerTon > 0) {
            // Use the greater of the actual weight or the minimum weight for calculation
            const effectiveWeight = Math.max(weightInLbs, MINIMUM_WEIGHT);
            const tons = effectiveWeight / 2000;
            calculatedCost = tons * ratePerTon;
        }
        
        const calculatedFreightCostEl = document.getElementById('calculatedFreightCost');
        if (calculatedFreightCostEl) {
            calculatedFreightCostEl.value = calculatedCost.toFixed(2);
        }
    }

    async handleLogout() {
        try {
            await Auth.logout();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Logout failed.');
            window.location.href = 'index.html';
        }
    }

    async openShipmentFormModal() { // Made async
        this.editingShipmentId = null;
        document.getElementById('shipment-form-title').textContent = 'Add New Shipment';
        document.getElementById('shipment-form').reset();
        document.getElementById('shipment-db-id').value = '';
        await this.loadDrivers(); // Ensure fresh driver list
        this.populateDriverDropdown();
        await this.loadCustomers(); // Ensure fresh customer list
        this.populateCustomerDropdown();
        document.getElementById('weight').value = '';
        document.getElementById('rate').value = '';   
        this.updateCalculatedFreightCost(); 
        document.getElementById('shipment-form-modal').style.display = 'block'; 
    }

    closeShipmentFormModal() { 
        document.getElementById('shipment-form-modal').style.display = 'none'; 
        document.getElementById('shipment-form').reset();
        document.getElementById('shipment-form-error').style.display = 'none';
        this.editingShipmentId = null;
    }

    async loadShipments(page = 1) {
        this.currentPage = page;
        const loadingMsg = document.getElementById('loading-shipments-msg');
        const tableContainer = document.getElementById('shipments-table-container');
        const paginationControlsContainer = document.getElementById('shipments-pagination-controls');

        if (loadingMsg) loadingMsg.style.display = 'block';
        if (tableContainer) tableContainer.innerHTML = ''; 
        if (paginationControlsContainer) paginationControlsContainer.innerHTML = ''; 


        try {
            const response = await API.getShipments(`?sortBy=deliveryDate:desc&page=${this.currentPage}&limit=${this.limit}`);
            this.shipments = (response && Array.isArray(response.data)) ? response.data : [];
            if (response && response.pagination) {
                this.currentPage = response.pagination.currentPage;
                this.totalPages = response.pagination.totalPages;
            } else {
                const totalShipments = response && response.pagination && response.pagination.totalShipments !== undefined 
                                       ? response.pagination.totalShipments 
                                       : this.shipments.length; 
                this.totalPages = Math.ceil(totalShipments / this.limit) || 1;
                if(this.shipments.length === 0 && totalShipments > 0 && this.currentPage > 1) { 
                    return this.loadShipments(this.currentPage -1);
                }
            }

            if (loadingMsg) loadingMsg.style.display = 'none';
            this.renderShipmentsTable();
            this.renderPaginationControls();
        } catch (error) {
            console.error('Failed to load shipments:', error);
            if (loadingMsg) loadingMsg.style.display = 'none';
            if (tableContainer) tableContainer.innerHTML = '<p class="error-message">Error loading shipments.</p>';
            this.shipments = [];
            this.renderShipmentsTable(); 
            this.renderPaginationControls(); 
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
                    <th>Delivery Date</th>
                    <th>Shipping Number</th>
                    <th>Pick-up/Destination</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Driver</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        this.shipments.forEach(shipment => {
            const row = tbody.insertRow();
            row.dataset.shipmentId = shipment._id; 

            const originCity = shipment.origin && shipment.origin.city ? shipment.origin.city : 'N/A';
            const destCity = shipment.destination && shipment.destination.city ? shipment.destination.city : 'N/A';
            const pickupDestCombined = `${originCity} / ${destCity}`;

            const deliveryDateStr = shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : 'N/A'; 
            const customerNameStr = shipment.customer && shipment.customer.name ? shipment.customer.name : 'N/A';
            const statusStr = shipment.status || 'unknown';
            const driverNameStr = shipment.driver ? (shipment.driver.fullName || (shipment.driver.firstName && shipment.driver.lastName ? `${shipment.driver.firstName} ${shipment.driver.lastName}` : 'Unknown Driver')) : 'Not Assigned';

            row.innerHTML = `
                <td data-field="deliveryDate">${deliveryDateStr}</td>
                <td data-field="shippingNumber">${shipment.shippingNumber || 'N/A'}</td>
                <td data-field="pickupDestination">${pickupDestCombined}</td>
                <td data-field="customer" data-value="${shipment.customer?._id || ''}">${customerNameStr}</td>
                <td data-field="status" data-value="${statusStr}"><span class="status-badge status-${statusStr}">${statusStr}</span></td>
                <td data-field="driver" data-value="${shipment.driver?._id || ''}">${driverNameStr}</td>
                <td class="actions-cell">
                    <button class="btn-action btn-edit" data-id="${shipment._id}">Edit</button>
                    <button class="btn-action btn-delete" data-id="${shipment._id}">Delete</button>
                    <button class="btn-action btn-details" data-id="${shipment._id}">Details</button>
                </td>
            `;
            
            const editButton = row.querySelector('.btn-edit');
            if (editButton) {
                editButton.addEventListener('click', () => this.showEditShipmentForm(shipment._id));
            }

            row.querySelector('.btn-delete').addEventListener('click', () => this.handleDeleteShipment(shipment._id));
            row.querySelector('.btn-details').addEventListener('click', () => this.showShipmentDetails(shipment._id));

            // Event listeners for inline editing (excluding the new combined cell)
            const customerCell = row.querySelector('td[data-field="customer"]');
            if (customerCell) {
                customerCell.addEventListener('click', (e) => {
                    if (e.target.tagName === 'TD' || e.target.tagName === 'SPAN') {
                        this.toggleRowEditMode(shipment._id, row);
                    }
                });
            }
            const statusCell = row.querySelector('td[data-field="status"]');
            if (statusCell) {
                statusCell.addEventListener('click', (e) => {
                    if (e.target.tagName === 'TD' || e.target.tagName === 'SPAN') {
                         this.toggleRowEditMode(shipment._id, row);
                    }
                });
            }
            const driverCell = row.querySelector('td[data-field="driver"]');
            if (driverCell) {
                driverCell.addEventListener('click', (e) => {
                     if (e.target.tagName === 'TD' || e.target.tagName === 'SPAN') {
                        this.toggleRowEditMode(shipment._id, row);
                    }
                });
            }
            const deliveryDateCell = row.querySelector('td[data-field="deliveryDate"]');
            if (deliveryDateCell) {
                deliveryDateCell.addEventListener('click', (e) => {
                    if (e.target.tagName === 'TD' || e.target.tagName === 'SPAN') {
                        this.toggleRowEditMode(shipment._id, row);
                    }
                });
            }
             const shippingNumberCell = row.querySelector('td[data-field="shippingNumber"]');
            if (shippingNumberCell) {
                shippingNumberCell.addEventListener('click', (e) => {
                    if (e.target.tagName === 'TD' || e.target.tagName === 'SPAN') {
                        this.toggleRowEditMode(shipment._id, row);
                    }
                });
            }
        });
        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    renderPaginationControls() {
        const container = document.getElementById('shipments-pagination-controls');
        if (!container) return;
        container.innerHTML = ''; 

        if (this.totalPages <= 1) return; 

        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.className = 'btn-secondary';
        prevButton.disabled = this.currentPage === 1;
        prevButton.addEventListener('click', () => this.loadShipments(this.currentPage - 1));
        container.appendChild(prevButton);

        const pageInfo = document.createElement('span');
        pageInfo.textContent = ` Page ${this.currentPage} of ${this.totalPages} `;
        pageInfo.style.margin = "0 10px";
        container.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.className = 'btn-secondary';
        nextButton.disabled = this.currentPage === this.totalPages;
        nextButton.addEventListener('click', () => this.loadShipments(this.currentPage + 1));
        container.appendChild(nextButton);
    }
    
    async loadDrivers() {
        try {
            const driverResponse = await API.getDrivers();
            this.drivers = (driverResponse && Array.isArray(driverResponse.data)) ? driverResponse.data : [];
            this.populateDriverDropdown(); 
        } catch (error) {
            console.error('Failed to load drivers:', error);
            this.drivers = [];
            this.populateDriverDropdown();
        }
    }

    populateDriverDropdown(selectElementId = 'driver', selectedDriverId = null) {
        const driverSelect = document.getElementById(selectElementId);
        if (!driverSelect) return;
        driverSelect.innerHTML = '<option value="">-- Select Driver --</option>';
        if (this.drivers && this.drivers.length > 0) {
            this.drivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver._id;
                option.textContent = driver.fullName || (driver.firstName && driver.lastName ? `${driver.firstName} ${driver.lastName}` : 'Unknown Driver');
                if (driver._id === selectedDriverId) option.selected = true;
                driverSelect.appendChild(option);
            });
        }
    }

    async loadCustomers() {
        console.log('[shipments.js] Entering loadCustomers...');
        try {
            const response = await API.getCustomers();
            console.log('API response from getCustomers (for shipments page):', response);
            this.customers = (response && Array.isArray(response.data)) ? response.data.filter(c => c.isActive !== false) : [];
            this.populateCustomerDropdown(); 
        } catch (error) {
            console.error('Failed to load customers for dropdown:', error);
            this.customers = [];
            this.populateCustomerDropdown();
        }
    }

    populateCustomerDropdown(selectElementId = 'shipment-customer-select', selectedCustomerId = null) {
        const customerSelect = document.getElementById(selectElementId);
        if (!customerSelect) return;
        customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';
        if (this.customers && this.customers.length > 0) {
            this.customers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer._id;
                option.textContent = customer.name;
                if (customer._id === selectedCustomerId) option.selected = true;
                customerSelect.appendChild(option);
            });
        }
    }
    
    collectFormData(formData) { 
        return {
            shippingNumber: formData.get('shippingNumber'), 
            origin: { // Added origin back
                street: formData.get('origin.street'),
                city: formData.get('origin.city'),
                state: formData.get('origin.state'),
                zipCode: formData.get('origin.zipCode')
            },
            destination: {
                street: formData.get('destination.street'),
                city: formData.get('destination.city'),
                state: formData.get('destination.state'),
                zipCode: formData.get('destination.zipCode')
            },
            customer: formData.get('customer'), 
            deliveryDate: formData.get('deliveryDate'), 
            status: formData.get('status'),
            driver: formData.get('driver') || null,
            truckNumber: formData.get('truckNumber'),
            weight: parseFloat(formData.get('weight')) || null,
            // Rate is entered in Dollars/Ton, send as is
            rate: formData.get('rate') ? parseFloat(formData.get('rate')) : null,
            notes: formData.get('notes')
        };
    }
    async handleShipmentFormSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const errorDiv = document.getElementById('shipment-form-error');
        const submitBtn = form.querySelector('button[type="submit"]');

        const shipmentData = this.collectFormData(formData);

        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = this.editingShipmentId ? 'Saving...' : 'Creating...';
        
        try {
            let response;
            if (this.editingShipmentId) {
                response = await API.updateShipment(this.editingShipmentId, shipmentData);
            } else {
                response = await API.createShipment(shipmentData);
            }

            if (response && response.success) {
                alert(`Shipment ${this.editingShipmentId ? 'updated' : 'created'} successfully!`);
                this.closeShipmentFormModal();
                this.loadShipments(this.editingShipmentId ? this.currentPage : 1); 
            } else {
                throw new Error(response.message || `Failed to ${this.editingShipmentId ? 'update' : 'create'} shipment.`);
            }
        } catch (error) {
            console.error('Shipment form submission error:', error);
            errorDiv.textContent = error.message || 'An unknown error occurred.';
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
        form.reset();

        document.getElementById('shipment-db-id').value = shipment._id;
        document.getElementById('shippingNumber').value = shipment.shippingNumber || ''; 
        
        if (shipment.origin) { // Populate origin fields
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

        // For editing, ensure dropdowns are populated with fresh data before setting values
        await this.loadCustomers();
        this.populateCustomerDropdown('shipment-customer-select', shipment.customer?._id || shipment.customer);
        
        document.getElementById('deliveryDate').value = shipment.deliveryDate ? new Date(shipment.deliveryDate).toISOString().split('T')[0] : '';
        document.getElementById('status').value = shipment.status || 'pending';

        await this.loadDrivers();
        this.populateDriverDropdown('driver', shipment.driver?._id || shipment.driver);
        
        document.getElementById('truckNumber').value = shipment.truckNumber || '';
        document.getElementById('weight').value = shipment.weight != null ? shipment.weight : '';
        // Rate is stored in Dollars/Ton, display as is
        document.getElementById('rate').value = shipment.rate != null ? shipment.rate : '';
        this.updateCalculatedFreightCost();
        document.getElementById('shipment-notes').value = shipment.notes || '';
        
        document.getElementById('shipment-form-modal').style.display = 'block';
    }
    
    async handleDeleteShipment(shipmentDbId) {
        const shipment = this.shipments.find(s => s._id === shipmentDbId);
        if (!shipment) {
            alert('Error: Shipment not found for deletion.');
            return;
        }

        if (confirm(`Are you sure you want to delete Shipping Number: ${shipment.shippingNumber || shipmentDbId}?`)) { 
            try {
                const response = await API.deleteShipment(shipmentDbId);
                if (response && response.success) {
                    alert('Shipment deleted successfully!');
                    if (this.shipments.length === 1 && this.currentPage > 1) {
                        this.loadShipments(this.currentPage - 1);
                    } else {
                        this.loadShipments(this.currentPage);
                    }
                } else {
                    throw new Error(response.message || 'Failed to delete shipment.');
                }
            } catch (error) {
                console.error('Failed to delete shipment:', error);
                alert(`Error deleting shipment: ${error.message}`);
            }
        }
    }

    async showShipmentDetails(shipmentDbId) {
        const shipment = this.shipments.find(s => s._id === shipmentDbId);
        if (!shipment) {
            alert('Error: Shipment details not found.');
            return;
        }

        const detailsContent = document.getElementById('shipment-details-content');
        if (!detailsContent) {
            console.error('Shipment details content element not found.');
            return;
        }

        const driverName = shipment.driver ? (shipment.driver.fullName || (shipment.driver.firstName && shipment.driver.lastName ? `${shipment.driver.firstName} ${shipment.driver.lastName}` : 'Unknown Driver')) : 'N/A';
        const customerName = shipment.customer ? shipment.customer.name : 'N/A';
        const originCity = shipment.origin && shipment.origin.city ? shipment.origin.city : 'N/A';
        const destinationCity = shipment.destination && shipment.destination.city ? shipment.destination.city : 'N/A';
        
        detailsContent.innerHTML = `
            <p><strong>Shipping Number:</strong> ${shipment.shippingNumber || 'N/A'}</p> 
            <p><strong>Status:</strong> <span class="status-badge status-${shipment.status || 'unknown'}">${shipment.status || 'unknown'}</span></p>
            <p><strong>Delivery Date:</strong> ${shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Origin City:</strong> ${originCity}</p>
            <p><strong>Destination City:</strong> ${destinationCity}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Driver:</strong> ${driverName}</p>
            <p><strong>Truck Number:</strong> ${shipment.truckNumber || 'N/A'}</p>
            <p><strong>Weight:</strong> ${shipment.weight != null ? shipment.weight + ' lbs' : 'N/A'}</p> 
            <p><strong>Rate:</strong> ${shipment.rate != null ? '$' + shipment.rate.toFixed(4) + '/lb' : 'N/A'}</p> 
            <p><strong>Calculated Freight Cost:</strong> ${shipment.freightCost != null ? '$' + shipment.freightCost.toFixed(2) : 'N/A'}</p>
            <p><strong>Actual Pickup Date:</strong> ${shipment.actualPickupDate ? new Date(shipment.actualPickupDate).toLocaleString() : 'N/A'}</p>
            <p><strong>Actual Delivery Date:</strong> ${shipment.actualDeliveryDate ? new Date(shipment.actualDeliveryDate).toLocaleString() : 'N/A'}</p>
            <p><strong>Notes:</strong> ${shipment.notes || 'N/A'}</p>
            <p><strong>Created At:</strong> ${shipment.createdAt ? new Date(shipment.createdAt).toLocaleString() : 'N/A'}</p>
            <p><strong>Updated At:</strong> ${shipment.updatedAt ? new Date(shipment.updatedAt).toLocaleString() : 'N/A'}</p>
        `;

        const detailsModal = document.getElementById('shipment-details-modal');
        if (detailsModal) {
            detailsModal.style.display = 'block';
        }
    }

    closeShipmentDetailsModal() {
        const detailsModal = document.getElementById('shipment-details-modal');
        if (detailsModal) {
            detailsModal.style.display = 'none';
        }
        const detailsContent = document.getElementById('shipment-details-content');
        if (detailsContent) {
            detailsContent.innerHTML = '<p>Loading details...</p>'; 
        }
    }

    // --- Row-based Inline Editing Logic ---
    toggleRowEditMode(shipmentId, rowElement) {
        const isEditing = rowElement.classList.contains('row-editing');
        const shipment = this.shipments.find(s => s._id === shipmentId);

        if (!shipment) {
            console.error("Shipment not found for toggling edit mode:", shipmentId);
            return;
        }

        const otherEditingRow = document.querySelector('tr.row-editing');
        if (otherEditingRow && otherEditingRow !== rowElement) {
            const otherShipmentId = otherEditingRow.dataset.shipmentId;
            const otherShipment = this.shipments.find(s => s._id === otherShipmentId);
            if (otherShipment) this.transformRowToDisplay(otherEditingRow, otherShipment);
        }
        
        if (isEditing) {
            this.transformRowToDisplay(rowElement, shipment); 
        } else {
            this.transformRowToEdit(rowElement, shipment);
        }
    }

    transformRowToEdit(row, shipment) {
        row.classList.add('row-editing');
        
        const originalCellsData = Array.from(row.cells).map(cell => ({
            field: cell.dataset.field,
            html: cell.innerHTML,
            value: cell.dataset.value 
        }));
        row.dataset.originalCellsHTML = JSON.stringify(originalCellsData);

        Array.from(row.cells).forEach((cell) => {
            const field = cell.dataset.field;
            let currentValue = cell.dataset.value || '';
            if (!cell.dataset.value && field !== 'actions' && field !== 'status') {
                 currentValue = cell.textContent.trim();
            }
            if (field === 'status') currentValue = shipment.status;

            cell.innerHTML = ''; 
            let inputElement;

            switch (field) {
                case 'shippingNumber': 
                    inputElement = document.createElement('input'); 
                    inputElement.type = 'text';
                    inputElement.name = 'shippingNumber';
                    inputElement.value = shipment.shippingNumber || '';
                    break;
                case 'pickupDestination': // Combined field, not directly editable inline this way
                    inputElement = document.createElement('span');
                    const originCity = shipment.origin && shipment.origin.city ? shipment.origin.city : 'N/A';
                    const destCity = shipment.destination && shipment.destination.city ? shipment.destination.city : 'N/A';
                    inputElement.textContent = `${originCity} / ${destCity}`;
                    break;
                case 'deliveryDate': 
                    inputElement = document.createElement('input');
                    inputElement.type = 'date';
                    inputElement.name = 'deliveryDate';
                    inputElement.value = shipment.deliveryDate ? new Date(shipment.deliveryDate).toISOString().split('T')[0] : '';
                    break;
                case 'customer':
                    inputElement = document.createElement('select');
                    inputElement.name = 'customer';
                    this.customers.forEach(cust => {
                        const opt = document.createElement('option');
                        opt.value = cust._id;
                        opt.textContent = cust.name;
                        if (cust._id === currentValue) opt.selected = true;
                        inputElement.appendChild(opt);
                    });
                    break;
                case 'status':
                    inputElement = document.createElement('select');
                    inputElement.name = 'status';
                    const statuses = ['pending', 'assigned', 'in-transit', 'delayed', 'delivered', 'cancelled', 'on-hold'];
                    statuses.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s;
                        opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
                        if (s === currentValue) opt.selected = true;
                        inputElement.appendChild(opt);
                    });
                    break;
                case 'driver':
                    inputElement = document.createElement('select');
                    inputElement.name = 'driver';
                    const noneDriverOption = document.createElement('option');
                    noneDriverOption.value = ""; 
                    noneDriverOption.textContent = "-- Unassign --";
                    inputElement.appendChild(noneDriverOption);
                    this.drivers.forEach(drv => {
                        const opt = document.createElement('option');
                        opt.value = drv._id;
                        opt.textContent = drv.fullName || (drv.firstName && drv.lastName ? `${drv.firstName} ${drv.lastName}` : 'Unknown Driver');
                        if (drv._id === currentValue) opt.selected = true;
                        inputElement.appendChild(opt);
                    });
                    break;
                case 'actions':
                    return; 
                default:
                    inputElement = document.createElement('span');
                    inputElement.textContent = cell.textContent; 
                    break;
            }
            if (inputElement) {
                inputElement.classList.add('form-control-inline'); 
                cell.appendChild(inputElement);
            }
        });

        const actionsCell = row.querySelector('.actions-cell');
        if (actionsCell) {
            actionsCell.innerHTML = ''; 
            const saveButton = document.createElement('button');
            saveButton.textContent = 'Save';
            saveButton.className = 'btn-action btn-save-row btn-success';
            saveButton.onclick = () => this.handleSaveRow(shipment._id, row);
            actionsCell.appendChild(saveButton);

            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.className = 'btn-action btn-secondary btn-cancel-row';
            cancelButton.onclick = () => this.handleCancelRowEdit(row, shipment);
            actionsCell.appendChild(cancelButton);
        }
    }

    transformRowToDisplay(row, shipment) {
        row.classList.remove('row-editing');
        const originalCellsData = JSON.parse(row.dataset.originalCellsHTML || '[]');

        Array.from(row.cells).forEach((cell) => {
            const field = cell.dataset.field;
            const originalCell = originalCellsData.find(c => c.field === field);

            if (originalCell && field !== 'actions') {
                cell.innerHTML = originalCell.html;
            } else if (field !== 'actions') { 
                const originCity = shipment.origin && shipment.origin.city ? shipment.origin.city : 'N/A';
                const destCity = shipment.destination && shipment.destination.city ? shipment.destination.city : 'N/A';
                const pickupDestCombined = `${originCity} / ${destCity}`;
                const deliveryDateStr = shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : 'N/A'; 
                const customerNameStr = shipment.customer && shipment.customer.name ? shipment.customer.name : 'N/A';
                const statusStr = shipment.status || 'unknown';
                const driverNameStr = shipment.driver ? (shipment.driver.fullName || (shipment.driver.firstName && shipment.driver.lastName ? `${shipment.driver.firstName} ${shipment.driver.lastName}` : 'Unknown Driver')) : 'Not Assigned';

                switch(field) {
                    case 'deliveryDate': cell.textContent = deliveryDateStr; break; 
                    case 'shippingNumber': cell.textContent = shipment.shippingNumber || 'N/A'; break; 
                    case 'pickupDestination': cell.textContent = pickupDestCombined; break;
                    case 'customer': cell.innerHTML = `<span>${customerNameStr}</span>`; break;
                    case 'status': cell.innerHTML = `<div class="editable-cell-content"><span class="status-badge status-${statusStr}">${statusStr}</span></div>`; break;
                    case 'driver': cell.innerHTML = `<span>${driverNameStr}</span>`; break;
                }
            }
        });

        const actionsCell = row.querySelector('.actions-cell');
        if (actionsCell) {
            actionsCell.innerHTML = `
                <button class="btn-action btn-edit" data-id="${shipment._id}">Edit</button>
                <button class="btn-action btn-delete" data-id="${shipment._id}">Delete</button>
                <button class="btn-action btn-details" data-id="${shipment._id}">Details</button>
            `;
            const editButton = actionsCell.querySelector('.btn-edit');
            if (editButton) {
                 editButton.addEventListener('click', () => this.showEditShipmentForm(shipment._id));
            }
            const deleteButton = actionsCell.querySelector('.btn-delete');
            if (deleteButton) {
                deleteButton.addEventListener('click', () => this.handleDeleteShipment(shipment._id));
            }
            const detailsButton = actionsCell.querySelector('.btn-details');
            if (detailsButton) {
                detailsButton.addEventListener('click', () => this.showShipmentDetails(shipment._id));
            }
        }
        delete row.dataset.originalCellsHTML;
    }

    async handleSaveRow(shipmentId, row) {
        const updatedData = {};
        const inputs = row.querySelectorAll('input[name], select[name]');
        let isValid = true;
        const currentShipment = this.shipments.find(s => s._id === shipmentId);

        inputs.forEach(input => {
            const fieldName = input.name;
            if (input.required && !input.value && input.type !== 'hidden') {
                isValid = false;
            }
            // For combined pickup/destination, inline editing is complex and not handled here.
            // This save logic assumes individual fields if they were made editable.
            // Since we are moving to modal for primary edits, this might be simplified or removed for these fields.
            if (fieldName === 'destination' || fieldName === 'origin') { 
                // This logic would need to parse a combined field or expect individual city inputs
                // For now, assuming modal handles these edits primarily.
                // If inline editing for individual city parts was implemented:
                // const parts = input.value.split(',').map(s => s.trim());
                // updatedData[fieldName] = { 
                //     ...(currentShipment[fieldName] || {}), 
                //     city: parts[0] || '', 
                //     // state: parts[1] || '' // Only city is required/editable inline for now
                // };
            } else {
                updatedData[fieldName] = input.value === "" && (fieldName === "driver") ? null : input.value;
            }
        });

        if (!isValid) {
            alert('Please fill all required fields or correct errors.');
            return;
        }

        try {
            const response = await API.updateShipment(shipmentId, updatedData);
            if (response && response.success && response.data) {
                const updatedShipmentFromServer = response.data; 
                const shipmentIndex = this.shipments.findIndex(s => s._id === shipmentId);
                if (shipmentIndex > -1) {
                    this.shipments[shipmentIndex] = updatedShipmentFromServer; 
                }
                this.transformRowToDisplay(row, updatedShipmentFromServer);
                alert('Shipment updated successfully!');
            } else {
                throw new Error(response.message || 'Failed to update shipment.');
            }
        } catch (error) {
            console.error('Error saving row:', error);
            alert(`Error saving shipment: ${error.message}`);
            const originalShipment = this.shipments.find(s => s._id === shipmentId);
            if (originalShipment) this.transformRowToDisplay(row, originalShipment);
        }
    }

    handleCancelRowEdit(row, shipment) { 
        this.transformRowToDisplay(row, shipment);
    }
    // --- End Row-based Inline Editing Logic ---
}

// Initialize the shipments page logic when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Auth === 'undefined') {
        console.error('Auth class is not defined. Make sure auth.js is loaded before shipments.js');
        alert('Critical application error. Please try reloading.');
        window.location.href = 'index.html';
        return;
    }
    window.shipmentsPage = new ShipmentsPage();
});