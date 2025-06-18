// Invoice Management Module
class InvoiceManager {
    constructor() {
        this.currentInvoice = null;
        this.customers = [];
        this.drivers = [];
        this.lineItems = [];
    }

    // Initialize invoice management
    async init() {
        try {
            // Load customers and drivers for dropdowns
            const [customersResponse, driversResponse] = await Promise.all([
                API.getCustomers({ status: 'active' }),
                API.getActiveDrivers()
            ]);
            
            this.customers = customersResponse.data.customers;
            this.drivers = driversResponse.data;
        } catch (error) {
            console.error('Failed to initialize invoice manager:', error);
            this.showError('Failed to load initial data');
        }
    }

    // Display invoice list
    async displayInvoiceList(container) {
        try {
            container.innerHTML = '<div class="loading">Loading invoices...</div>';
            
            const response = await API.getInvoices({
                page: 1,
                limit: 20,
                sortBy: 'invoiceDate',
                order: 'desc'
            });

            const { invoices, pagination } = response.data;
            
            container.innerHTML = `
                <div class="section-header">
                    <h2>Invoices</h2>
                    <button class="btn-primary" onclick="invoiceManager.showCreateForm()">
                        <i class="icon-plus"></i> Create Invoice
                    </button>
                </div>
                
                <div class="filters-bar">
                    <input type="text" id="invoice-search" placeholder="Search invoices..." class="search-input">
                    <select id="invoice-status-filter" class="filter-select">
                        <option value="">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="viewed">Viewed</option>
                        <option value="paid">Paid</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <select id="payment-status-filter" class="filter-select">
                        <option value="">Payment Status</option>
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                    </select>
                </div>
                
                <div class="invoice-stats">
                    ${await this.renderInvoiceStats()}
                </div>
                
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Invoice #</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoices.map(invoice => this.renderInvoiceRow(invoice)).join('')}
                    </tbody>
                </table>
                
                ${this.renderPagination(pagination)}
            `;

            // Add event listeners
            this.attachInvoiceListeners();
        } catch (error) {
            console.error('Failed to load invoices:', error);
            container.innerHTML = '<div class="error">Failed to load invoices</div>';
        }
    }

    // Render invoice row
    renderInvoiceRow(invoice) {
        const statusClass = `status-${invoice.status}`;
        const paymentClass = `payment-${invoice.paymentStatus}`;
        
        return `
            <tr>
                <td><a href="#" onclick="invoiceManager.viewInvoice('${invoice._id}')">${invoice.invoiceNumber}</a></td>
                <td>${new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                <td>${invoice.customer.companyName}</td>
                <td>$${invoice.invoiceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td><span class="status-badge ${statusClass}">${invoice.status}</span></td>
                <td><span class="payment-badge ${paymentClass}">${invoice.paymentStatus}</span></td>
                <td class="actions">
                    <button class="btn-small" onclick="invoiceManager.viewInvoice('${invoice._id}')" title="View">
                        <i class="icon-eye"></i>
                    </button>
                    ${invoice.status !== 'paid' ? `
                        <button class="btn-small" onclick="invoiceManager.editInvoice('${invoice._id}')" title="Edit">
                            <i class="icon-edit"></i>
                        </button>
                    ` : ''}
                    ${invoice.status === 'draft' ? `
                        <button class="btn-small" onclick="invoiceManager.sendInvoice('${invoice._id}')" title="Send">
                            <i class="icon-send"></i>
                        </button>
                    ` : ''}
                    ${invoice.paymentStatus !== 'paid' ? `
                        <button class="btn-small" onclick="invoiceManager.showPaymentForm('${invoice._id}')" title="Record Payment">
                            <i class="icon-dollar"></i>
                        </button>
                    ` : ''}
                    <button class="btn-small" onclick="invoiceManager.downloadPDF('${invoice._id}')" title="Download PDF">
                        <i class="icon-download"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    // Render invoice statistics
    async renderInvoiceStats() {
        try {
            const response = await API.getInvoiceStatistics();
            const { summary } = response.data;
            
            return `
                <div class="stat-card">
                    <div class="stat-value">$${(summary.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$${(summary.totalOutstanding || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div class="stat-label">Outstanding</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${summary.totalInvoices || 0}</div>
                    <div class="stat-label">Total Invoices</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$${(summary.averageInvoiceAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div class="stat-label">Average Invoice</div>
                </div>
            `;
        } catch (error) {
            console.error('Failed to load statistics:', error);
            return '';
        }
    }

    // Show create invoice form
    showCreateForm() {
        const container = document.getElementById('main-content');
        this.lineItems = [];
        
        container.innerHTML = `
            <div class="form-container">
                <h2>Create New Invoice</h2>
                <form id="invoice-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="customerId">Customer *</label>
                            <select id="customerId" name="customerId" required>
                                <option value="">Select Customer</option>
                                ${this.customers.map(c => `<option value="${c._id}">${c.companyName}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="projectDescription">Project Description</label>
                            <input type="text" id="projectDescription" name="projectDescription" placeholder="e.g., Scrap metal delivery - June 2025">
                        </div>
                    </div>
                    
                    <div class="line-items-section">
                        <h3>Line Items</h3>
                        <table class="line-items-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Shipping #</th>
                                    <th>Destination</th>
                                    <th>Driver</th>
                                    <th>Truck #</th>
                                    <th>Price/Ton</th>
                                    <th>Weight (lbs)</th>
                                    <th>Amount</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="line-items-tbody">
                                <!-- Line items will be added here -->
                            </tbody>
                        </table>
                        <button type="button" class="btn-secondary" onclick="invoiceManager.addLineItem()">
                            <i class="icon-plus"></i> Add Line Item
                        </button>
                    </div>
                    
                    <div class="invoice-summary">
                        <div class="summary-row">
                            <span>Subtotal:</span>
                            <span id="subtotal">$0.00</span>
                        </div>
                        <div class="summary-row">
                            <span>Fuel Surcharge (<span id="fuel-rate">35</span>%):</span>
                            <span id="fuel-surcharge">$0.00</span>
                        </div>
                        <div class="summary-row">
                            <span>Deposit:</span>
                            <input type="number" id="deposit" name="deposit" value="0" min="0" step="0.01" onchange="invoiceManager.calculateTotals()">
                        </div>
                        <div class="summary-row total">
                            <span>Invoice Total:</span>
                            <span id="invoice-total">$0.00</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="notes">Notes</label>
                        <textarea id="notes" name="notes" rows="3"></textarea>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="invoiceManager.cancelForm()">Cancel</button>
                        <button type="submit" class="btn-primary">Create Invoice</button>
                    </div>
                </form>
            </div>
        `;

        // Add first line item
        this.addLineItem();
        
        // Add form submit listener
        document.getElementById('invoice-form').addEventListener('submit', (e) => this.handleCreateInvoice(e));
        
        // Add customer change listener
        document.getElementById('customerId').addEventListener('change', (e) => this.handleCustomerChange(e.target.value));
    }

    // Add line item to form
    addLineItem() {
        const index = this.lineItems.length;
        const tbody = document.getElementById('line-items-tbody');
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="date" name="lineItems[${index}][date]" required value="${new Date().toISOString().split('T')[0]}"></td>
            <td><input type="text" name="lineItems[${index}][shippingNumber]" required placeholder="60001"></td>
            <td><input type="text" name="lineItems[${index}][destination]" required placeholder="City/Location"></td>
            <td>
                <select name="lineItems[${index}][driverId]" required onchange="invoiceManager.handleDriverChange(${index}, this.value)">
                    <option value="">Select Driver</option>
                    ${this.drivers.map(d => `<option value="${d._id}">${d.fullName}</option>`).join('')}
                </select>
            </td>
            <td><input type="text" name="lineItems[${index}][truckNumber]" required readonly></td>
            <td><input type="number" name="lineItems[${index}][price]" required step="0.01" min="0" placeholder="0.00" onchange="invoiceManager.calculateLineAmount(${index})"></td>
            <td><input type="number" name="lineItems[${index}][weight]" required step="1" min="0" placeholder="0" onchange="invoiceManager.calculateLineAmount(${index})"></td>
            <td class="line-amount">$0.00</td>
            <td><button type="button" class="btn-small btn-danger" onclick="invoiceManager.removeLineItem(${index})">×</button></td>
        `;
        
        tbody.appendChild(row);
        this.lineItems.push({ index, amount: 0 });
    }

    // Handle driver selection change
    async handleDriverChange(index, driverId) {
        if (!driverId) return;
        
        const driver = this.drivers.find(d => d._id === driverId);
        if (driver) {
            // Try to get truck number from driver data
            const truckInput = document.querySelector(`input[name="lineItems[${index}][truckNumber]"]`);
            if (truckInput) {
                // For now, we'll need to implement truck assignment
                // This is a placeholder - in real implementation, get from driver.truckNumber
                truckInput.value = 'T101'; // Placeholder
            }
        }
    }

    // Calculate line item amount
    calculateLineAmount(index) {
        const priceInput = document.querySelector(`input[name="lineItems[${index}][price]"]`);
        const weightInput = document.querySelector(`input[name="lineItems[${index}][weight]"]`);
        const amountCell = document.querySelectorAll('.line-amount')[index];
        
        if (priceInput && weightInput && amountCell) {
            const price = parseFloat(priceInput.value) || 0;
            const weight = parseFloat(weightInput.value) || 0;
            const tons = weight / 2000; // Convert pounds to tons
            const amount = price * tons;
            
            this.lineItems[index].amount = amount;
            amountCell.textContent = `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            
            this.calculateTotals();
        }
    }

    // Calculate invoice totals
    calculateTotals() {
        const subtotal = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
        const fuelRate = 0.35; // Default 35%
        const fuelSurcharge = subtotal * fuelRate;
        const deposit = parseFloat(document.getElementById('deposit').value) || 0;
        const total = subtotal + fuelSurcharge - deposit;
        
        document.getElementById('subtotal').textContent = `$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('fuel-surcharge').textContent = `$${fuelSurcharge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('invoice-total').textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Handle customer change
    async handleCustomerChange(customerId) {
        if (!customerId) return;
        
        const customer = this.customers.find(c => c._id === customerId);
        if (customer && customer.defaultFuelSurchargeRate) {
            document.getElementById('fuel-rate').textContent = (customer.defaultFuelSurchargeRate * 100).toFixed(0);
            this.calculateTotals();
        }
    }

    // Handle create invoice form submission
    async handleCreateInvoice(event) {
        event.preventDefault();
        
        try {
            const formData = new FormData(event.target);
            const invoiceData = {
                customerId: formData.get('customerId'),
                projectDescription: formData.get('projectDescription'),
                deposit: parseFloat(formData.get('deposit')) || 0,
                notes: formData.get('notes'),
                lineItems: []
            };
            
            // Collect line items
            for (let i = 0; i < this.lineItems.length; i++) {
                const date = formData.get(`lineItems[${i}][date]`);
                if (date) {
                    const driverId = formData.get(`lineItems[${i}][driverId]`);
                    const driver = this.drivers.find(d => d._id === driverId);
                    
                    invoiceData.lineItems.push({
                        date,
                        shippingNumber: formData.get(`lineItems[${i}][shippingNumber]`),
                        destination: formData.get(`lineItems[${i}][destination]`),
                        driverId,
                        driverName: driver ? driver.fullName : '',
                        truckNumber: formData.get(`lineItems[${i}][truckNumber]`),
                        price: parseFloat(formData.get(`lineItems[${i}][price]`)),
                        weight: parseFloat(formData.get(`lineItems[${i}][weight]`))
                    });
                }
            }
            
            const response = await API.createInvoice(invoiceData);
            this.showSuccess('Invoice created successfully');
            this.displayInvoiceList(document.getElementById('main-content'));
        } catch (error) {
            console.error('Failed to create invoice:', error);
            this.showError('Failed to create invoice');
        }
    }

    // View invoice details
    async viewInvoice(invoiceId) {
        try {
            const container = document.getElementById('main-content');
            container.innerHTML = '<div class="loading">Loading invoice...</div>';
            
            const response = await API.getInvoice(invoiceId);
            const invoice = response.data;
            
            container.innerHTML = this.renderInvoiceDetail(invoice);
        } catch (error) {
            console.error('Failed to load invoice:', error);
            this.showError('Failed to load invoice');
        }
    }

    // Render invoice detail view
    renderInvoiceDetail(invoice) {
        return `
            <div class="invoice-detail">
                <div class="invoice-header">
                    <div class="company-info">
                        <h1>Leek Brokerage Inc</h1>
                        <p>P.O. Box 20145<br>Canton, OH 44701<br>Phone: 330-324-5421</p>
                    </div>
                    <div class="invoice-info">
                        <h2>Invoice #${invoice.invoiceNumber}</h2>
                        <p>Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                        <p>Status: <span class="status-badge status-${invoice.status}">${invoice.status}</span></p>
                        <p>Payment: <span class="payment-badge payment-${invoice.paymentStatus}">${invoice.paymentStatus}</span></p>
                    </div>
                </div>
                
                <div class="customer-info">
                    <h3>Bill To:</h3>
                    <p><strong>${invoice.billTo}</strong></p>
                    ${invoice.customer.billingAddress ? `
                        <p>${invoice.customer.billingAddress.street1}<br>
                        ${invoice.customer.billingAddress.city}, ${invoice.customer.billingAddress.state} ${invoice.customer.billingAddress.zipCode}</p>
                    ` : ''}
                </div>
                
                ${invoice.projectDescription ? `
                    <div class="project-info">
                        <h3>For:</h3>
                        <p>${invoice.projectDescription}</p>
                    </div>
                ` : ''}
                
                <table class="invoice-items">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Shipping #</th>
                            <th>Destination</th>
                            <th>Driver</th>
                            <th>Truck #</th>
                            <th>Price/Ton</th>
                            <th>Weight</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoice.lineItems.map(item => `
                            <tr>
                                <td>${new Date(item.date).toLocaleDateString()}</td>
                                <td>${item.shippingNumber}</td>
                                <td>${item.destination}</td>
                                <td>${item.driverName}</td>
                                <td>${item.truckNumber}</td>
                                <td>$${item.price.toFixed(2)}</td>
                                <td>${item.weight.toLocaleString()} lbs</td>
                                <td>$${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="6"></td>
                            <td><strong>Subtotal:</strong></td>
                            <td><strong>$${invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                        </tr>
                        <tr>
                            <td colspan="6"></td>
                            <td>Fuel Surcharge (${(invoice.fuelSurchargeRate * 100).toFixed(0)}%):</td>
                            <td>$${invoice.fuelSurcharge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        ${invoice.deposit > 0 ? `
                            <tr>
                                <td colspan="6"></td>
                                <td>Deposit:</td>
                                <td>-$${invoice.deposit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        ` : ''}
                        <tr class="total-row">
                            <td colspan="6"></td>
                            <td><strong>Invoice Total:</strong></td>
                            <td><strong>$${invoice.invoiceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                
                <div class="invoice-footer">
                    <p><strong>Payment Terms:</strong> ${invoice.paymentTerms}</p>
                    ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
                </div>
                
                <div class="invoice-actions">
                    <button class="btn-secondary" onclick="invoiceManager.displayInvoiceList(document.getElementById('main-content'))">Back to List</button>
                    ${invoice.status !== 'paid' ? `<button class="btn-primary" onclick="invoiceManager.editInvoice('${invoice._id}')">Edit Invoice</button>` : ''}
                    ${invoice.status === 'draft' ? `<button class="btn-primary" onclick="invoiceManager.sendInvoice('${invoice._id}')">Send Invoice</button>` : ''}
                    ${invoice.paymentStatus !== 'paid' ? `<button class="btn-primary" onclick="invoiceManager.showPaymentForm('${invoice._id}')">Record Payment</button>` : ''}
                    <button class="btn-primary" onclick="invoiceManager.downloadPDF('${invoice._id}')">Download PDF</button>
                </div>
            </div>
        `;
    }

    // Show payment form
    showPaymentForm(invoiceId) {
        // Implementation for payment form
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Record Payment</h3>
                <form id="payment-form">
                    <div class="form-group">
                        <label for="payment-amount">Payment Amount</label>
                        <input type="number" id="payment-amount" step="0.01" min="0.01" required>
                    </div>
                    <div class="form-group">
                        <label for="payment-date">Payment Date</label>
                        <input type="date" id="payment-date" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label for="payment-notes">Notes</label>
                        <textarea id="payment-notes" rows="3"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn-primary">Record Payment</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('payment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.recordPayment(invoiceId, {
                    amount: parseFloat(document.getElementById('payment-amount').value),
                    paymentDate: document.getElementById('payment-date').value,
                    notes: document.getElementById('payment-notes').value
                });
                
                modal.remove();
                this.showSuccess('Payment recorded successfully');
                this.viewInvoice(invoiceId);
            } catch (error) {
                console.error('Failed to record payment:', error);
                this.showError('Failed to record payment');
            }
        });
    }

    // Helper methods
    removeLineItem(index) {
        // Implementation for removing line items
    }

    cancelForm() {
        this.displayInvoiceList(document.getElementById('main-content'));
    }

    attachInvoiceListeners() {
        // Add search and filter listeners
        const searchInput = document.getElementById('invoice-search');
        const statusFilter = document.getElementById('invoice-status-filter');
        const paymentFilter = document.getElementById('payment-status-filter');
        
        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => this.filterInvoices(), 300));
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterInvoices());
        }
        
        if (paymentFilter) {
            paymentFilter.addEventListener('change', () => this.filterInvoices());
        }
    }

    async filterInvoices() {
        const search = document.getElementById('invoice-search').value;
        const status = document.getElementById('invoice-status-filter').value;
        const paymentStatus = document.getElementById('payment-status-filter').value;
        
        const params = {};
        if (search) params.search = search;
        if (status) params.status = status;
        if (paymentStatus) params.paymentStatus = paymentStatus;
        
        // Reload invoice list with filters
        this.displayInvoiceList(document.getElementById('main-content'));
    }

    renderPagination(pagination) {
        if (pagination.pages <= 1) return '';
        
        let html = '<div class="pagination">';
        
        if (pagination.page > 1) {
            html += `<button onclick="invoiceManager.loadPage(${pagination.page - 1})">Previous</button>`;
        }
        
        for (let i = 1; i <= pagination.pages; i++) {
            if (i === pagination.page) {
                html += `<span class="current-page">${i}</span>`;
            } else {
                html += `<button onclick="invoiceManager.loadPage(${i})">${i}</button>`;
            }
        }
        
        if (pagination.page < pagination.pages) {
            html += `<button onclick="invoiceManager.loadPage(${pagination.page + 1})">Next</button>`;
        }
        
        html += '</div>';
        return html;
    }

    showError(message) {
        // Show error notification
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }

    showSuccess(message) {
        // Show success notification
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
}

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize invoice manager
const invoiceManager = new InvoiceManager();
