// Driver Commissions Page Logic
class DriverCommissionsPage {
    constructor() {
        this.commissionReportData = [];
        this.drivers = []; // For the filter dropdown
        this.currentUser = null;
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
        this.loadDriversForFilter(); // Load drivers for the filter dropdown
    }

    updateUserInfo() {
        const userNameSpan = document.getElementById('user-name-commissions');
        if (userNameSpan && this.currentUser) {
            userNameSpan.textContent = `Welcome, ${this.currentUser.fullName || this.currentUser.firstName || this.currentUser.username}`;
        }
    }

    bindEventListeners() {
        const logoutBtn = document.getElementById('logout-btn-commissions');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        const backToDashboardBtn = document.getElementById('back-to-dashboard-btn-commissions');
        if (backToDashboardBtn) {
            backToDashboardBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        const commissionFilterForm = document.getElementById('commission-filter-form');
        if (commissionFilterForm) {
            commissionFilterForm.addEventListener('submit', this.handleGenerateReport.bind(this));
        }

        const downloadPdfBtn = document.getElementById('download-commission-pdf-btn');
        if (downloadPdfBtn) {
            downloadPdfBtn.addEventListener('click', this.handleDownloadCommissionPdf.bind(this));
        }

        // Modal event listeners for "Add Driver" are removed as the button and modal are removed.
        // const showAddDriverModalBtn = document.getElementById('show-add-driver-modal-btn');
        // if (showAddDriverModalBtn) {
        //     showAddDriverModalBtn.addEventListener('click', this.openAddDriverModal.bind(this));
        // }

        // const closeAddDriverModalBtn = document.getElementById('close-add-driver-modal-btn');
        // if (closeAddDriverModalBtn) {
        //     closeAddDriverModalBtn.addEventListener('click', this.closeAddDriverModal.bind(this));
        // }

        // const addDriverForm = document.getElementById('add-driver-form');
        // if (addDriverForm) {
        //     addDriverForm.addEventListener('submit', this.handleAddDriverSubmit.bind(this));
        // }
        
        // const addDriverModal = document.getElementById('add-driver-modal');
        // if (addDriverModal) {
        //     window.addEventListener('click', (event) => {
        //         if (event.target === addDriverModal) {
        //             this.closeAddDriverModal();
        //         }
        //     });
        // }
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

    async loadDriversForFilter() {
        try {
            const response = await API.getDrivers(); // Assumes API.getDrivers() exists
            if (response && Array.isArray(response.data)) {
                this.drivers = response.data;
            } else if (response && Array.isArray(response.drivers)) {
                this.drivers = response.drivers;
            } else if (Array.isArray(response)) {
                this.drivers = response;
            }
             else {
                console.error('Unexpected response structure for drivers list:', response);
                this.drivers = [];
            }
            this.populateDriverFilterDropdown();
        } catch (error) {
            console.error('Failed to load drivers for filter:', error);
            this.drivers = [];
            this.populateDriverFilterDropdown(); // Still populate, will show only "All Drivers"
        }
    }

    populateDriverFilterDropdown() {
        const driverSelect = document.getElementById('commission-driver-select');
        if (!driverSelect) return;

        driverSelect.innerHTML = '<option value="">All Drivers</option>'; // Default option
        if (this.drivers && this.drivers.length > 0) {
            this.drivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver._id;
                option.textContent = driver.fullName || (driver.firstName && driver.lastName ? `${driver.firstName} ${driver.lastName}` : 'Unknown Driver');
                driverSelect.appendChild(option);
            });
        }
    }

    async handleGenerateReport(event) {
        event.preventDefault();
        const loadingMsg = document.getElementById('loading-commission-report-msg');
        const tableContainer = document.getElementById('commission-report-table-container');
        
        if (loadingMsg) loadingMsg.textContent = 'Generating report...';
        if (tableContainer) tableContainer.innerHTML = ''; // Clear previous table

        const formData = new FormData(event.target);
        const driverId = formData.get('driverId');
        const startDate = formData.get('startDate');
        const endDate = formData.get('endDate');

        try {
            // Construct query parameters
            const queryParams = new URLSearchParams();
            if (driverId) queryParams.append('driverId', driverId);
            if (startDate) queryParams.append('startDate', startDate);
            if (endDate) queryParams.append('endDate', endDate);
            
            // Assuming an API method like API.getCommissionReport(queryParamsString)
            // For now, let's assume it's part of a generic makeRequest or a specific method
            const response = await API.makeRequest(`/reports/commission?${queryParams.toString()}`);
            
            if (response && Array.isArray(response.data)) {
                this.commissionReportData = response.data;
            } else {
                console.error('Unexpected response structure for commission report:', response);
                this.commissionReportData = [];
            }

            if (loadingMsg) loadingMsg.style.display = 'none';
            this.renderCommissionReportTable();

        } catch (error) {
            console.error('Failed to generate commission report:', error);
            if (loadingMsg) loadingMsg.textContent = `Error generating report: ${error.message}`;
            else if (tableContainer) tableContainer.innerHTML = `<p class="error-message">Error generating report: ${error.message}</p>`;
            this.commissionReportData = [];
            this.renderCommissionReportTable(); // Attempt to render (will show "no data")
        }
    }

    renderCommissionReportTable() {
        const tableContainer = document.getElementById('commission-report-table-container');
        if (!tableContainer) return;
        
        // Clear any previous message like "Select filters..."
        const loadingMsg = document.getElementById('loading-commission-report-msg');
        if (loadingMsg) loadingMsg.style.display = 'none';


        if (!this.commissionReportData || this.commissionReportData.length === 0) {
            tableContainer.innerHTML = '<p>No commission data found for the selected criteria.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Shipment #</th>
                    <th>Pick-up/Dest.</th>
                    <th>Driver</th>
                    <th>Truck #</th>
                    <th>Weight</th>
                    <th>Amount</th>
                    <th>Rate</th>
                    <th>Commission</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;

        const tbody = table.querySelector('tbody');
        let totalCommission = 0;
        this.commissionReportData.forEach(item => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}</td>
                <td>${item.shipmentId || 'N/A'}</td>
                <td>${item.pickupDestination || 'N/A'}</td>
                <td>${item.driverName || 'N/A'}</td>
                <td>${item.truckNumber || 'N/A'}</td>
                <td>${item.weight != null ? item.weight.toLocaleString() : 'N/A'}</td>
                <td>${item.amount != null ? '$' + item.amount.toFixed(2) : 'N/A'}</td>
                <td>${item.commissionRate != null ? (item.commissionRate * 100).toFixed(0) + '%' : 'N/A'}</td>
                <td>${item.commissionAmount != null ? '$' + item.commissionAmount.toFixed(2) : 'N/A'}</td>
            `;
            totalCommission += item.commissionAmount || 0;
        });
        
        // Add a footer row for total commission
        const tfoot = table.createTFoot();
        const footerRow = tfoot.insertRow();
        footerRow.innerHTML = `
            <td colspan="7" style="text-align: right; font-weight: bold;">Total Commission:</td>
            <td style="font-weight: bold;">$${totalCommission.toFixed(2)}</td>
        `;

        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    // "Add Driver" Modal Logic (openAddDriverModal, closeAddDriverModal, handleAddDriverSubmit) is removed.

    async handleDownloadCommissionPdf() {
        const commissionFilterForm = document.getElementById('commission-filter-form');
        const formData = new FormData(commissionFilterForm);
        const driverId = formData.get('driverId');
        const startDate = formData.get('startDate');
        const endDate = formData.get('endDate');
        const token = localStorage.getItem('authToken');

        if (!token) {
            alert('Authentication token not found. Please log in again.');
            Auth.logout();
            window.location.href = 'index.html';
            return;
        }

        const queryParams = new URLSearchParams();
        if (driverId) queryParams.append('driverId', driverId);
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);
        queryParams.append('format', 'pdf');

        const reportUrl = `${window.API_BASE_URL}/reports/commission?${queryParams.toString()}`;

        try {
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
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            
            // Extract filename from content-disposition header if possible, otherwise use a default
            const disposition = response.headers.get('content-disposition');
            let filename = 'DriverCommissionReport.pdf'; // Default filename
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(downloadUrl);

        } catch (error) {
            console.error('Failed to download commission PDF:', error);
            alert(`Error downloading commission PDF: ${error.message}`);
        }
    }
}

// Initialize the page logic when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Auth === 'undefined') {
        console.error('Auth class is not defined. Make sure auth.js is loaded before driver-commissions.js');
        alert('Critical application error. Please try reloading.');
        window.location.href = 'index.html';
        return;
    }
    window.driverCommissionsPage = new DriverCommissionsPage();
});