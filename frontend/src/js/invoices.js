// Invoices Page Logic
class InvoicesPage {
    constructor() {
        this.invoices = [];
        this.currentUser = null;
        this.editingInvoiceId = null;
        this.availableShipments = [];
        this.allCustomers = []; // Stores all active customers for the dropdown
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
        console.log('[invoices.js] Entering loadInitialInvoicePageData...');
        try {
            await this.loadAllCustomersForDropdown();
            console.log('[invoices.js] loadAllCustomersForDropdown completed.');
            await this.loadAvailableShipmentsForForm();
            console.log('[invoices.js] loadAvailableShipmentsForForm completed.');
            await this.loadInvoices();
            console.log('[invoices.js] loadInvoices completed.');
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

    async loadInvoices() {
        const loadingMsg = document.getElementById('loading-invoices-msg');
        const tableContainer = document.getElementById('invoices-table-container');
        
        if (loadingMsg) loadingMsg.style.display = 'block';
        if (tableContainer) tableContainer.innerHTML = '';

        try {
            // Assuming API.getInvoices() exists and returns { data: [...] } or similar
            const response = await API.getInvoices();
            console.log('API response from getInvoices:', response); // Log the raw response
            if (response && Array.isArray(response.data)) {
                this.invoices = response.data;
            } else if (response && Array.isArray(response.invoices)) {
                this.invoices = response.invoices;
            } else if (Array.isArray(response)) {
                this.invoices = response;
            }
             else {
                console.error('Unexpected response structure for invoices:', response);
                this.invoices = [];
            }

            if (loadingMsg) loadingMsg.style.display = 'none';
            this.renderInvoicesTable();
        } catch (error) {
            console.error('Failed to load invoices:', error);
            if (loadingMsg) loadingMsg.style.display = 'none';
            if (tableContainer) tableContainer.innerHTML = '<p class="error-message">Error loading invoices. Please try again later.</p>';
            this.invoices = [];
            this.renderInvoicesTable(); // Attempt to render (will show "no invoices")
        }
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
            const issueDateStr = invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : 'N/A';
            const dueDateStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A';
            const totalAmountStr = invoice.totalAmount != null ? '$' + invoice.totalAmount.toFixed(2) : 'N/A';
            const statusStr = invoice.status || 'unknown';

            row.innerHTML = `
                <td>${invoice.invoiceNumber || 'N/A'}</td>
                <td>${customerNameStr}</td>
                <td>${issueDateStr}</td>
                <td>${dueDateStr}</td>
                <td>${totalAmountStr}</td>
                <td><span class="status-badge status-${statusStr}">${statusStr}</span></td>
                <td>
                    <button class="btn-action btn-view-pdf" data-id="${invoice._id}">View PDF</button>
                    <button class="btn-action btn-edit btn-edit-invoice" data-id="${invoice._id}">Edit</button>
                    <button class="btn-action btn-delete btn-delete-invoice" data-id="${invoice._id}">Delete</button>
                </td>
            `;
            row.querySelector('.btn-view-pdf').addEventListener('click', (e) => this.handleViewInvoicePdf(e.target.dataset.id));
            row.querySelector('.btn-edit-invoice').addEventListener('click', (e) => this.openEditInvoiceModal(e.target.dataset.id));
            row.querySelector('.btn-delete-invoice').addEventListener('click', (e) => this.handleDeleteInvoice(e.target.dataset.id));
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
            // The API.makeRequest needs to handle blob response for PDF
            // We'll adjust API.js or add a specific method if needed.
            // For now, construct the URL and open in new tab.
            // This relies on the browser handling the PDF stream.
            // For a more robust solution, fetch as blob and create object URL.

            const token = localStorage.getItem('authToken');
            if (!token) {
                alert('Authentication token not found. Please log in again.');
                Auth.logout(); // Force logout
                window.location.href = 'index.html';
                return;
            }
            
            // Construct URL for the PDF report
            const reportUrl = `${API_BASE_URL}/reports/invoice/${invoiceId}?format=pdf`;

            // Option 1: Direct navigation (simplest, relies on browser PDF handling & auth cookie if set)
            // window.open(reportUrl, '_blank'); 
            // This won't work if auth is Bearer token in header, as browser won't send it.

            // Option 2: Fetch with token and create blob URL (more robust for Bearer token)
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
            window.open(pdfUrl, '_blank');
            URL.revokeObjectURL(pdfUrl); // Clean up the object URL after opening

        } catch (error) {
            console.error('Failed to view/download invoice PDF:', error);
            alert(`Error generating invoice PDF: ${error.message}`);
        }
    }

    // Invoice Modal Logic
    openCreateInvoiceModal() {
        this.editingInvoiceId = null;
        document.getElementById('invoice-form-title').textContent = 'Create New Invoice';
        document.getElementById('invoice-form').reset();
        document.getElementById('invoice-status-group').style.display = 'none';
        // this.populateCustomerDropdown(); // Called by loadAllCustomersForDropdown
        this.populateShipmentsDropdown(null);
        document.getElementById('invoice-customer-contact-email').value = '';
        document.getElementById('invoice-form-modal').style.display = 'block';
    }

    async openEditInvoiceModal(invoiceId) {
        this.editingInvoiceId = invoiceId;
        const invoice = this.invoices.find(inv => inv._id === invoiceId);
        if (!invoice) {
            alert('Error: Invoice not found for editing.');
            return;
        }

        document.getElementById('invoice-form-title').textContent = 'Edit Invoice';
        const form = document.getElementById('invoice-form');
        form.reset();

        document.getElementById('invoice-edit-id').value = invoice._id;
        
        // this.populateCustomerDropdown(); // Called by loadAllCustomersForDropdown
        const customerIdToSelect = invoice.customer && invoice.customer._id ? invoice.customer._id : invoice.customer;
        document.getElementById('invoice-customer-select').value = customerIdToSelect || '';
        
        const selectedCustomerInEdit = this.allCustomers.find(c => c._id === customerIdToSelect);
        document.getElementById('invoice-customer-contact-email').value = selectedCustomerInEdit ? (selectedCustomerInEdit.contactEmail || '') : (invoice.customer && invoice.customer.contactEmail ? invoice.customer.contactEmail : '');

        // For editing, shipments are usually fixed, but we might allow changing status or notes.
        // Disabling shipment selection for edit for now, as changing shipments on an existing invoice is complex.
        const shipmentSelect = document.getElementById('invoice-shipments-select');
        shipmentSelect.innerHTML = ''; // Clear it
        if(invoice.shipments && invoice.shipments.length > 0) {
            invoice.shipments.forEach(ship => {
                const option = document.createElement('option');
                option.value = ship._id || ship; // Seeded data might just have ID, populated might have object
                option.textContent = `Shipment ID: ${ship.shipmentId || ship._id} (Already Invoiced)`;
                option.selected = true;
                option.disabled = true; // Cannot change shipments on existing invoice via this simple form
                shipmentSelect.appendChild(option);
            });
        }
        shipmentSelect.disabled = true;


        if (invoice.dueDate) {
            document.getElementById('invoice-due-date').value = new Date(invoice.dueDate).toISOString().split('T')[0];
        }
        document.getElementById('invoice-fuel-surcharge-rate').value = invoice.fuelSurchargeRate || 0;
        document.getElementById('invoice-deposit-amount').value = invoice.depositAmount || 0;
        document.getElementById('invoice-notes').value = invoice.notes || '';
        
        const statusGroup = document.getElementById('invoice-status-group');
        const statusSelect = document.getElementById('invoice-status');
        statusSelect.value = invoice.status || 'draft';
        statusGroup.style.display = 'block'; // Show status for editing

        document.getElementById('invoice-form-modal').style.display = 'block';
    }

    closeInvoiceModal() {
        document.getElementById('invoice-form-modal').style.display = 'none';
        document.getElementById('invoice-shipments-select').disabled = false; // Re-enable for next create
    }

    async loadAvailableShipmentsForForm(customerId = null) {
        console.log(`[invoices.js] Entering loadAvailableShipmentsForForm, customerId: ${customerId}`);
        try {
            let query = '/shipments?status=delivered&invoiced=false';
            if (customerId) {
                query += `&customer=${customerId}`; // Filter by customer ID
            }
            const response = await API.makeRequest(query);
            console.log(`[invoices.js] API response from getAvailableShipments (customer: ${customerId}):`, response); // New log
            
            if (response && Array.isArray(response.data)) {
                this.availableShipments = response.data;
            } else {
                console.error("[invoices.js] Failed to load available shipments or unexpected structure:", response);
                this.availableShipments = [];
            }
            this.populateShipmentsDropdown();
        } catch (error) {
            console.error('[invoices.js] Failed to load available shipments:', error);
            this.availableShipments = [];
            this.populateShipmentsDropdown();
        }
    }

    async loadAllCustomersForDropdown() {
        console.log('[invoices.js] Entering loadAllCustomersForDropdown...');
        try {
            const response = await API.getCustomers('?isActive=true');
            console.log('[invoices.js] API response from getCustomers:', response);
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
                if(customer.contactEmail) option.dataset.contactEmail = customer.contactEmail;
                selectElement.appendChild(option);
            });
        } else {
            console.log('[invoices.js] No customers to populate in dropdown.');
        }

        // Try to restore previous selection if it's still valid
        if (this.allCustomers.find(c => c._id === currentVal)) {
             selectElement.value = currentVal;
        }
        
        selectElement.removeEventListener('change', this.handleCustomerSelectChange.bind(this));
        selectElement.addEventListener('change', this.handleCustomerSelectChange.bind(this));
    }
    
    handleCustomerSelectChange(event) {
        const selectedCustomerId = event.target.value;
        const selectedOption = event.target.selectedOptions[0];
        const contactEmailField = document.getElementById('invoice-customer-contact-email');
        
        if (selectedOption && selectedOption.dataset.contactEmail) {
            contactEmailField.value = selectedOption.dataset.contactEmail;
        } else {
             contactEmailField.value = '';
        }
        this.loadAvailableShipmentsForForm(selectedCustomerId);
    }

    populateShipmentsDropdown() {
        const selectElement = document.getElementById('invoice-shipments-select');
        if (!selectElement) return;
        selectElement.innerHTML = ''; // Clear existing options

        // availableShipments is now filtered by loadAvailableShipmentsForForm based on customer selection
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
            option.value = shipment._id;
            try {
                const customerName = shipment.customer && shipment.customer.name ? shipment.customer.name : 'N/A Customer';
                const destCity = shipment.destination && shipment.destination.city ? shipment.destination.city : 'N/A City';
                const destState = shipment.destination && shipment.destination.state ? shipment.destination.state : 'N/A State';
                const freightCost = shipment.freightCost != null ? shipment.freightCost : 0;

                option.textContent = `ID: ${shipment.shipmentId || 'N/A ID'} - ${customerName} - Dest: ${destCity}, ${destState} - Cost: $${freightCost.toFixed(2)}`;
            } catch (e) {
                console.error(`Error processing shipment data for dropdown:`, shipment, e);
                option.textContent = `Error processing shipment: ${shipment._id || 'Unknown ID'}`;
            }
            selectElement.appendChild(option);
        });
    }

    async handleInvoiceFormSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const errorDiv = document.getElementById('invoice-form-error');
        const submitBtn = form.querySelector('button[type="submit"]');

        const selectedShipmentIds = Array.from(document.getElementById('invoice-shipments-select').selectedOptions).map(opt => opt.value);

        const invoiceData = {
            customerId: document.getElementById('invoice-customer-select').value, // This is customerId
            // customerContactEmail is not part of invoice model, it's on Customer model
            shipmentIds: selectedShipmentIds,
            dueDate: formData.get('dueDate') || null,
            fuelSurchargeRate: parseFloat(formData.get('fuelSurchargeRate')) || 0,
            depositAmount: parseFloat(formData.get('depositAmount')) || 0,
            notes: formData.get('notes')
        };
        
        if (this.editingInvoiceId) {
            invoiceData.status = formData.get('status'); // Only include status if editing
        }


        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = this.editingInvoiceId ? 'Saving...' : 'Creating...';

        try {
            let response;
            if (this.editingInvoiceId) {
                if (invoiceData.shipmentIds.length === 0) delete invoiceData.shipmentIds; // Don't send empty array if not changing
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
                this.loadInvoices(); // Refresh the list
                if (!this.editingInvoiceId) { // If creating, refresh available shipments
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
                    this.loadInvoices(); // Refresh the list
                    this.loadAvailableShipmentsForForm(); // Refresh, as shipments might become available
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