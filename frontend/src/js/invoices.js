// Invoices Page Logic
class InvoicesPage {
    constructor() {
        this.invoices = [];
        this.currentUser = null;
        this.editingInvoiceId = null;
        this.availableShipments = [];
        this.allCustomers = []; // Stores all active customers for the dropdown
        this.currentPage = 1;
        this.totalPages = 1;
        this.limit = 10; // Records per page
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
        this.loadInitialInvoicePageData();
    }

    async loadInitialInvoicePageData() {
        try {
            await this.loadAllCustomersForDropdown();
            await this.loadAvailableShipmentsForForm();
            await this.loadInvoices(); // Loads initial page
        } catch (error) {
            console.error('[invoices.js] Error in loadInitialInvoicePageData:', error);
        }
    }

    updateUserInfo() {
        const userNameSpan = document.getElementById('user-name-invoices');
        if (userNameSpan && this.currentUser) {
            userNameSpan.textContent = `Welcome, ${this.currentUser.fullName || this.currentUser.firstName || this.currentUser.username}`;
        }
    }

    bindEventListeners() {
        const logoutBtn = document.getElementById('logout-btn-invoices');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        const backToDashboardBtn = document.getElementById('back-to-dashboard-btn-invoices');
        if (backToDashboardBtn) {
            backToDashboardBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        const showCreateInvoiceFormBtn = document.getElementById('show-create-invoice-form-btn');
        if (showCreateInvoiceFormBtn) {
            showCreateInvoiceFormBtn.addEventListener('click', this.openCreateInvoiceModal.bind(this));
        }

        const closeInvoiceModalBtn = document.getElementById('close-invoice-modal-btn');
        if (closeInvoiceModalBtn) {
            closeInvoiceModalBtn.addEventListener('click', this.closeInvoiceModal.bind(this));
        }

        const invoiceForm = document.getElementById('invoice-form');
        if (invoiceForm) {
            invoiceForm.addEventListener('submit', this.handleInvoiceFormSubmit.bind(this));
        }
        
        const invoiceModal = document.getElementById('invoice-form-modal');
        if (invoiceModal) {
            window.addEventListener('click', (event) => {
                if (event.target === invoiceModal) {
                    this.closeInvoiceModal();
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

    async loadInvoices(page = 1) {
        this.currentPage = page;
        const loadingMsg = document.getElementById('loading-invoices-msg');
        const tableContainer = document.getElementById('invoices-table-container');
        const paginationControlsContainer = document.getElementById('invoices-pagination-controls');
        
        if (loadingMsg) loadingMsg.style.display = 'block';
        if (tableContainer) tableContainer.innerHTML = '';
        if (paginationControlsContainer) paginationControlsContainer.innerHTML = '';

        try {
            const response = await API.getInvoices(`?sortBy=issueDate:desc&page=${this.currentPage}&limit=${this.limit}`);
            this.invoices = (response && Array.isArray(response.data)) ? response.data : [];
            
            if (response && response.pagination) {
                this.currentPage = parseInt(response.pagination.currentPage, 10);
                this.totalPages = parseInt(response.pagination.totalPages, 10);
            } else {
                const totalInvoices = response && response.pagination && response.pagination.totalInvoices !== undefined 
                                       ? parseInt(response.pagination.totalInvoices, 10)
                                       : this.invoices.length; 
                this.totalPages = Math.ceil(totalInvoices / this.limit) || 1;
                if(this.invoices.length === 0 && totalInvoices > 0 && this.currentPage > 1) {
                    return this.loadInvoices(this.totalPages > 0 ? this.totalPages : 1);
                }
            }

            if (loadingMsg) loadingMsg.style.display = 'none';
            this.renderInvoicesTable();
            this.renderPaginationControls();
        } catch (error) {
            console.error('Failed to load invoices:', error);
            if (loadingMsg) loadingMsg.style.display = 'none';
            if (tableContainer) tableContainer.innerHTML = '<p class="error-message">Error loading invoices. Please try again later.</p>';
            this.invoices = [];
            this.renderInvoicesTable();
            this.renderPaginationControls();
        }
    }

    renderPaginationControls() {
        const container = document.getElementById('invoices-pagination-controls');
        if (!container) {
            return;
        }
        container.innerHTML = '';

        if (this.totalPages <= 1) {
            return;
        }

        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.className = 'btn-secondary';
        prevButton.disabled = this.currentPage === 1;
        prevButton.addEventListener('click', () => this.loadInvoices(this.currentPage - 1));
        container.appendChild(prevButton);

        const pageInfo = document.createElement('span');
        pageInfo.textContent = ` Page ${this.currentPage} of ${this.totalPages} `;
        pageInfo.style.margin = "0 10px";
        container.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.className = 'btn-secondary';
        nextButton.disabled = this.currentPage === this.totalPages;
        nextButton.addEventListener('click', () => this.loadInvoices(this.currentPage + 1));
        container.appendChild(nextButton);
    }

    renderInvoicesTable() {
        const tableContainer = document.getElementById('invoices-table-container');
        if (!tableContainer) return;

        if (!this.invoices || this.invoices.length === 0) {
            tableContainer.innerHTML = '<p>No invoices found.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Invoice #</th>
                    <th>Bill To</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;

        const tbody = table.querySelector('tbody');
        this.invoices.forEach(invoice => {
            const row = tbody.insertRow();

            const customerNameStr = invoice.customer && invoice.customer.name ? invoice.customer.name : 'N/A';
            const issueDateStr = invoice.issueDate ? `${new Date(invoice.issueDate).getUTCMonth() + 1}/${new Date(invoice.issueDate).getUTCDate()}/${new Date(invoice.issueDate).getUTCFullYear()}` : 'N/A';
            const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
            const dueDateStr = dueDate ? `${dueDate.getUTCMonth() + 1}/${dueDate.getUTCDate()}/${dueDate.getUTCFullYear()}` : 'N/A';
            const totalAmountStr = invoice.totalAmount != null ? '$' + invoice.totalAmount.toFixed(2) : 'N/A';
            const statusStr = invoice.status || 'unknown';

            row.innerHTML = `
                <td>${invoice.invoiceNumber || 'N/A'}</td>
                <td>${customerNameStr}</td>
                <td>${issueDateStr}</td>
                <td>${dueDateStr}</td>
                <td>${totalAmountStr}</td>
                <td class="invoice-status-cell editable-cell" data-invoice-id="${invoice._id}" data-current-status="${statusStr}"><span class="status-badge status-${statusStr}">${statusStr}</span></td>
                <td class="actions-cell">
                    <button class="btn-action btn-view-pdf" data-id="${invoice._id}">View PDF</button>
                    ${this.isInvoiceEditable(statusStr) ? `<button class="btn-action btn-edit btn-edit-invoice" data-id="${invoice._id}">Edit</button>` : ''}
                    <button class="btn-action btn-delete btn-delete-invoice" data-id="${invoice._id}">Delete</button>
                </td>
            `;
            row.querySelector('.btn-view-pdf').addEventListener('click', (e) => this.handleViewInvoicePdf(e.target.dataset.id));
            
            const editButton = row.querySelector('.btn-edit-invoice');
            if (editButton) {
                editButton.addEventListener('click', (e) => {
                    this.openEditInvoiceModal(e.target.dataset.id);
                });
            }

            row.querySelector('.btn-delete-invoice').addEventListener('click', (e) => this.handleDeleteInvoice(e.target.dataset.id));

            const statusCell = row.querySelector('.invoice-status-cell.editable-cell');
            if (statusCell) {
                statusCell.addEventListener('click', (e) => this.handleInvoiceStatusCellClick(e, invoice));
            }
        });

        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    async handleViewInvoicePdf(invoiceId) {
        if (!invoiceId) {
            alert('Invoice ID is missing.');
            return;
        }
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                alert('Authentication token not found. Please log in again.');
                Auth.logout(); 
                window.location.href = 'index.html';
                return;
            }
            
            const reportUrl = `${API_BASE_URL}/reports/invoice/${invoiceId}?format=pdf`;

            const response = await fetch(reportUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to download PDF. Server did not return valid JSON error.' }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const pdfUrl = URL.createObjectURL(blob);
            
            // Extract filename from Content-Disposition header
            let filename = `Invoice_${invoiceId}.pdf`; // Default filename
            const disposition = response.headers.get('Content-Disposition');
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            // Create a link and trigger download
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.setAttribute('download', filename); // Set the desired filename
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link); // Clean up

            URL.revokeObjectURL(pdfUrl); // Release the object URL

        } catch (error) {
            console.error('Failed to view/download invoice PDF:', error);
            alert(`Error generating invoice PDF: ${error.message}`);
        }
    }

    openCreateInvoiceModal() {
        this.editingInvoiceId = null;
        document.getElementById('invoice-form-title').textContent = 'Create New Invoice';
        document.getElementById('invoice-form').reset();
        document.getElementById('invoice-status-group').style.display = 'none';
        document.getElementById('invoice-number-group').style.display = 'none'; // Hide invoice number for new invoices
        this.populateShipmentsDropdown(null);
        // document.getElementById('invoice-fuel-surcharge-rate').value = '0'; // Field removed from HTML
        document.getElementById('invoice-form-modal').style.display = 'block';
    }

    async openEditInvoiceModal(invoiceId) {
        this.editingInvoiceId = invoiceId; // This is the _id
        const invoice = this.invoices.find(inv => inv._id === invoiceId);
        if (!invoice) {
            alert('Error: Invoice not found for editing.');
            return;
        }

        document.getElementById('invoice-form-title').textContent = 'Edit Invoice';
        const form = document.getElementById('invoice-form');
        form.reset();

        document.getElementById('invoice-edit-id').value = invoice._id; // Hidden field stores _id
        
        const invoiceNumberGroup = document.getElementById('invoice-number-group');
        const invoiceNumberInput = document.getElementById('invoice-number-input');
        if(invoiceNumberGroup) invoiceNumberGroup.style.display = 'block'; // Show invoice number field for editing
        if(invoiceNumberInput) invoiceNumberInput.value = invoice.invoiceNumber || '';
        
        const customerIdToSelect = invoice.customer && invoice.customer._id ? invoice.customer._id : invoice.customer;
        document.getElementById('invoice-customer-select').value = customerIdToSelect || '';
        
        const shipmentSelect = document.getElementById('invoice-shipments-select');
        shipmentSelect.innerHTML = ''; 
        if(invoice.shipments && invoice.shipments.length > 0) {
            invoice.shipments.forEach(ship => {
                const option = document.createElement('option');
                option.value = ship._id || ship; 
                // Assuming shipment object has shippingNumber after refactor, otherwise use ship.shipmentId
                option.textContent = `Shipment: ${ship.shippingNumber || ship.shipmentId || ship._id} (Invoiced)`; 
                option.selected = true;
                option.disabled = true; 
                shipmentSelect.appendChild(option);
            });
        }
        shipmentSelect.disabled = true;
        

        if (invoice.dueDate) {
            document.getElementById('invoice-due-date').value = new Date(invoice.dueDate).toISOString().split('T')[0];
        } else {
            document.getElementById('invoice-due-date').value = '';
        }
    
        document.getElementById('invoice-notes').value = invoice.notes || '';
        
        const statusGroup = document.getElementById('invoice-status-group');
        const statusSelect = document.getElementById('invoice-status');
        statusSelect.value = invoice.status || 'draft'; 
        statusGroup.style.display = 'block'; 

        document.getElementById('invoice-form-modal').style.display = 'block';
    }

    closeInvoiceModal() {
        document.getElementById('invoice-form-modal').style.display = 'none';
        document.getElementById('invoice-shipments-select').disabled = false; 
    }

    async loadAvailableShipmentsForForm(customerId = null) {
        try {
            let query = '/shipments?status=delivered&invoiced=false';
            if (customerId) {
                query += `&customer=${customerId}`; 
            }
            const response = await API.makeRequest(query);
            
            if (response && Array.isArray(response.data)) {
                this.availableShipments = response.data;
            } else {
                console.error("[invoices.js] Failed to load available shipments or unexpected structure:", response);
                this.availableShipments = [];
            }
            this.populateShipmentsDropdown();
        } catch (error) {
            console.error('[invoices.js] Failed to load available shipments for form:', error);
            this.availableShipments = [];
            this.populateShipmentsDropdown();
        }
    }

    async loadAllCustomersForDropdown() {
        try {
            const response = await API.getCustomers('?isActive=true');
            if (response && Array.isArray(response.data)) {
                this.allCustomers = response.data;
            } else {
                console.error('[invoices.js] Unexpected response structure for all customers list:', response);
                this.allCustomers = [];
            }
            this.populateCustomerDropdown();
        } catch (error) {
            console.error('[invoices.js] Failed to load all customers for dropdown:', error);
            this.allCustomers = [];
            this.populateCustomerDropdown();
        }
    }

    populateCustomerDropdown() {
        const selectElement = document.getElementById('invoice-customer-select');
        if (!selectElement) {
            console.error('[invoices.js] Customer select dropdown not found');
            return;
        }
        
        const currentVal = selectElement.value;
        selectElement.innerHTML = '<option value="">-- Select Customer --</option>';

        if (this.allCustomers && this.allCustomers.length > 0) {
            this.allCustomers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer._id;
                option.textContent = customer.name;
                selectElement.appendChild(option);
            });
        }
        
        if (this.allCustomers.find(c => c._id === currentVal)) {
             selectElement.value = currentVal;
        }
        
        selectElement.removeEventListener('change', this.handleCustomerSelectChange.bind(this));
        selectElement.addEventListener('change', this.handleCustomerSelectChange.bind(this));
    }
    
    handleCustomerSelectChange(event) {
        const selectedCustomerId = event.target.value;
        this.loadAvailableShipmentsForForm(selectedCustomerId);
    }

    populateShipmentsDropdown() {
        const selectElement = document.getElementById('invoice-shipments-select');
        if (!selectElement) return;
            selectElement.innerHTML = ''; 

        if (this.availableShipments.length === 0) {
            const selectedCustomerName = document.getElementById('invoice-customer-select').selectedOptions[0]?.textContent;
            const message = selectedCustomerName && selectedCustomerName !== '-- Select Customer --'
                ? `No available shipments for ${selectedCustomerName}`
                : 'Select a customer to see available shipments or no shipments available.';
            selectElement.innerHTML = `<option value="" disabled>${message}</option>`;
            return;
        }

        this.availableShipments.forEach(shipment => {
            const option = document.createElement('option');
            option.value = shipment._id; // Use internal _id for value
            try {
                const customerName = shipment.customer && shipment.customer.name ? shipment.customer.name : 'N/A Customer';
                const destCity = shipment.destination && shipment.destination.city ? shipment.destination.city : 'N/A City';
                const destState = shipment.destination && shipment.destination.state ? shipment.destination.state : 'N/A State';
                const freightCost = shipment.freightCost != null ? shipment.freightCost : 0;

                option.textContent = `ID: ${shipment.shippingNumber || 'N/A ID'} - ${customerName} - Dest: ${destCity}, ${destState} - Cost: $${freightCost.toFixed(2)}`; // Display shippingNumber
            } catch (e) {
                console.error(`Error processing shipment data for dropdown:`, shipment, e);
                option.textContent = `Error processing shipment: ${shipment._id || 'Unknown ID'}`;
            }
            selectElement.appendChild(option);
        });
    }

        isStatusInlineEditable(status) {
            if (!status) {
                return false;
            }
            const statusToCheck = status.toLowerCase();
            const editableStatuses = ['draft', 'sent', 'partially-paid', 'overdue'];
            const isEditable = editableStatuses.includes(statusToCheck);
            return isEditable;
        }

    isInvoiceEditable(status) {
        return status && status.toLowerCase() === 'draft';
    }

    handleInvoiceStatusCellClick(event, invoice) {
        const cell = event.currentTarget;
        const statusToCheck = cell.dataset.currentStatus; 

        const isEditable = this.isStatusInlineEditable(statusToCheck);
        const isAlreadyEditingCell = cell.classList.contains('cell-is-editing');

        if (!isEditable || isAlreadyEditingCell) {
            return;
        }

        const currentInvoiceStatusLower = statusToCheck ? statusToCheck.toLowerCase() : '';
        if (currentInvoiceStatusLower === 'draft') {
            this.openEditInvoiceModal(invoice._id);
            return;
        }

        const currentlyEditingOtherCell = document.querySelector('td.cell-is-editing');
        if (currentlyEditingOtherCell && currentlyEditingOtherCell !== cell) {
            this.cancelInvoiceStatusEdit(currentlyEditingOtherCell);
        }
        this.startInvoiceStatusEdit(cell, invoice); 
    }

    startInvoiceStatusEdit(cell, invoice) {
        if (cell.classList.contains('cell-is-editing')) {
            return;
        }

        cell.classList.add('cell-is-editing');
        const statusSpan = cell.querySelector('.status-badge');
        
        if (!statusSpan) {
            cell.classList.remove('cell-is-editing');
            return;
        }

        cell.dataset.originalStatusText = statusSpan.textContent; 
        cell.dataset.originalStatusClass = statusSpan.className;
        
        statusSpan.style.display = 'none';

        const selectElement = this.createInvoiceStatusSelect(cell.dataset.currentStatus, invoice._id, cell);

        if (!selectElement) {
            statusSpan.style.display = '';
            cell.classList.remove('cell-is-editing');
            delete cell.dataset.originalStatusText;
            delete cell.dataset.originalStatusClass;
            return;
        }
        
        cell.appendChild(selectElement);
        selectElement.focus();
    }

    createInvoiceStatusSelect(currentStatus, invoiceId, cell) { 
        const statusMapToBackend = {
            'Draft': 'draft',
            'Sent': 'sent',
            'Paid': 'paid',
            'Partially Paid': 'partially-paid',
            'Overdue': 'overdue',
            'Void': 'void'
        };
        const statusMapToDisplay = { 
            'draft': 'Draft',
            'sent': 'Sent',
            'paid': 'Paid',
            'partially-paid': 'Partially Paid',
            'overdue': 'Overdue',
            'void': 'Void'
        };

        const currentDisplayStatus = statusMapToDisplay[currentStatus] || currentStatus;
        const select = document.createElement('select');

        let allowedStatuses = []; 
        switch (currentDisplayStatus) { 
            case 'Draft': 
                allowedStatuses = ['Sent', 'Void'];
                break;
            case 'Sent':
                allowedStatuses = ['Paid', 'Partially Paid', 'Overdue', 'Void', 'Draft'];
                break;
            case 'Partially Paid':
                allowedStatuses = ['Paid', 'Overdue', 'Void', 'Sent'];
                break;
            case 'Overdue':
                allowedStatuses = ['Paid', 'Partially Paid', 'Void', 'Sent'];
                break;
            default:
                return null;
        }

        const defaultOption = document.createElement('option');
        defaultOption.value = statusMapToBackend[currentDisplayStatus] || currentStatus; 
        defaultOption.textContent = currentDisplayStatus; 
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        allowedStatuses.forEach(displayStatus => { 
            if (displayStatus === currentDisplayStatus) return; 
            const option = document.createElement('option');
            option.value = statusMapToBackend[displayStatus] || displayStatus.toLowerCase().replace(' ', '-'); 
            option.textContent = displayStatus; 
            select.appendChild(option);
        });
        
        if (select.options.length <= 1) {
            return null;
        }


        select.addEventListener('change', async (event) => {
            await this.saveInvoiceStatusChange(invoiceId, event.target.value, cell);
        });

        select.addEventListener('blur', () => {
            setTimeout(() => {
                if (cell.classList.contains('cell-is-editing') && cell.contains(select)) {
                    this.cancelInvoiceStatusEdit(cell);
                }
            }, 150); 
        });
        
        select.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.cancelInvoiceStatusEdit(cell);
            }
        });

        return select;
    }

    async saveInvoiceStatusChange(invoiceId, newStatusValue, cell) { 
        const currentBackendStatusInCell = cell.dataset.currentStatus;

        if (newStatusValue === currentBackendStatusInCell) {
            this.cancelInvoiceStatusEdit(cell);
            return;
        }

        try {
            const response = await API.updateInvoice(invoiceId, { status: newStatusValue });
            if (response && response.success && response.data) {
                const invoiceIndex = this.invoices.findIndex(inv => inv._id === invoiceId);
                if (invoiceIndex > -1) {
                    this.invoices[invoiceIndex].status = newStatusValue; 
                }
                cell.dataset.currentStatus = newStatusValue; 
                alert('Invoice status updated successfully!');
                this.cancelInvoiceStatusEdit(cell); 
                this.renderInvoicesTable(); 
            } else {
                throw new Error(response.message || 'Failed to update invoice status.');
            }
        } catch (error) {
            console.error('Failed to save invoice status:', error);
            alert(`Error updating status: ${error.message}`);
            this.cancelInvoiceStatusEdit(cell);
        }
    }

    cancelInvoiceStatusEdit(cell) {
        if (!cell.classList.contains('cell-is-editing')) return; 

        const selectElement = cell.querySelector('select');
        if (selectElement) {
            cell.removeChild(selectElement);
        }

        const statusSpan = cell.querySelector('.status-badge');
        if (statusSpan) {
            const backendStatus = cell.dataset.currentStatus;
            const statusMapToDisplay = {
                'draft': 'Draft', 'sent': 'Sent', 'paid': 'Paid',
                'partially-paid': 'Partially Paid', 'overdue': 'Overdue', 'void': 'Void'
            };
            const displayStatus = statusMapToDisplay[backendStatus] || backendStatus; 

            statusSpan.textContent = displayStatus;
            statusSpan.className = `status-badge status-${backendStatus.toLowerCase()}`; 
            statusSpan.style.display = ''; 
        } else if (cell.dataset.originalStatusText && cell.dataset.originalStatusClass) {
            const backendStatus = cell.dataset.currentStatus || (cell.dataset.originalStatusText ? cell.dataset.originalStatusText.toLowerCase().replace(' ', '-') : 'unknown');
             const statusMapToDisplay = {
                'draft': 'Draft', 'sent': 'Sent', 'paid': 'Paid',
                'partially-paid': 'Partially Paid', 'overdue': 'Overdue', 'void': 'Void'
            };
            const displayStatus = statusMapToDisplay[backendStatus] || backendStatus;

            cell.innerHTML = `<span class="${cell.dataset.originalStatusClass || `status-badge status-${backendStatus.toLowerCase()}`}">${displayStatus}</span>`;
        }
        
        delete cell.dataset.originalStatusText;
        delete cell.dataset.originalStatusClass;
        cell.classList.remove('cell-is-editing');
    }

    async handleInvoiceFormSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const errorDiv = document.getElementById('invoice-form-error');
        const submitBtn = form.querySelector('button[type="submit"]');

        const selectedShipmentIds = Array.from(document.getElementById('invoice-shipments-select').selectedOptions).map(opt => opt.value);

        const dueDateValue = formData.get('dueDate');
        let dueDateToSend = null;
        
        if (dueDateValue && dueDateValue.trim() !== '') {
            // Create a date object and ensure it's treated as UTC midnight
            // This prevents timezone shifts when saving/retrieving from the database
            const dateParts = dueDateValue.split('-');
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(dateParts[2], 10);
            dueDateToSend = new Date(Date.UTC(year, month, day)).toISOString();
        }
        
        const invoiceData = {
            customerId: document.getElementById('invoice-customer-select').value, 
            shipmentIds: selectedShipmentIds,
            dueDate: dueDateToSend,
            // fuelSurchargeRate is now determined by the backend based on the customer
            notes: formData.get('notes')
        };
        
        if (this.editingInvoiceId) {
            invoiceData.status = formData.get('status'); 
            invoiceData.invoiceNumber = formData.get('invoiceNumber'); // Add invoiceNumber to payload if editing
        }


        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = this.editingInvoiceId ? 'Saving...' : 'Creating...';

        try {
            let response;
            if (this.editingInvoiceId) {
                // For updates, fuelSurchargeRate is not sent from client; it's fixed on the invoice or recalculated if subTotal changes.
                // The check below for fuelSurchargeRate equality is no longer needed as it's not part of client-sent invoiceData for update.
                if (invoiceData.shipmentIds.length === 0 && !invoiceData.invoiceNumber && !invoiceData.status && !invoiceData.dueDate && !invoiceData.notes ) {
                    // If only shipments were potentially changed (not possible with current UI for edit)
                    // and no other fields changed, this condition might be met.
                    // However, the current logic disables shipment selection on edit.
                    // This block might need refinement based on exact desired update behavior.
                    // For now, if no shipments and no other changes, we might skip the API call or send it.
                    // The backend will handle if no actual changes are made.
                }
                 if (invoiceData.shipmentIds.length === 0) delete invoiceData.shipmentIds; // Don't send empty array if not changing shipments
                response = await API.updateInvoice(this.editingInvoiceId, invoiceData);
            } else {
                if (selectedShipmentIds.length === 0) {
                    throw new Error("At least one shipment must be selected to create an invoice.");
                }
                response = await API.createInvoice(invoiceData);
            }

            if (response && response.success) {
                alert(`Invoice ${this.editingInvoiceId ? 'updated' : 'created'} successfully!`);
                this.closeInvoiceModal();
                this.loadInvoices(); 
                if (!this.editingInvoiceId) { 
                    this.loadAvailableShipmentsForForm();
                }
            } else {
                throw new Error(response.message || `Failed to ${this.editingInvoiceId ? 'update' : 'create'} invoice.`);
            }
        } catch (error) {
            console.error(`Invoice form submission error:`, error);
            errorDiv.textContent = error.message || 'An unknown error occurred.';
            errorDiv.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Invoice';
        }
    }
    
    async handleDeleteInvoice(invoiceId) {
        const invoice = this.invoices.find(inv => inv._id === invoiceId);
        if (!invoice) {
            alert('Error: Invoice not found for deletion.');
            return;
        }

        if (confirm(`Are you sure you want to delete Invoice #${invoice.invoiceNumber}? This action may unlink it from shipments.`)) {
            try {
                const response = await API.deleteInvoice(invoiceId);
                if (response && response.success) {
                    alert('Invoice deleted successfully!');
                    this.loadInvoices(); 
                    this.loadAvailableShipmentsForForm(); 
                } else {
                    throw new Error(response.message || 'Failed to delete invoice.');
                }
            } catch (error) {
                console.error('Failed to delete invoice:', error);
                alert(`Error deleting invoice: ${error.message}`);
            }
        }
    }
}

// Initialize the invoices page logic when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Auth === 'undefined') {
        console.error('Auth class is not defined. Make sure auth.js is loaded before invoices.js');
        alert('Critical application error. Please try reloading.');
        window.location.href = 'index.html';
        return;
    }
    window.invoicesPage = new InvoicesPage();
});