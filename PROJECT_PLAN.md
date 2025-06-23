# LeekBrokerage Inc - Trucking Logistics Application: Development Plan

## 1. Overview

This document outlines the development plan for completing the LeekBrokerage Inc trucking logistics application. The application uses a Node.js/Express backend, a Vanilla JavaScript frontend, and MongoDB as the database.

## 2. Current Status Summary

*   **Project Goal:** A trucking logistics management system.
*   **Technology Stack:** Node.js/Express backend, Vanilla JS frontend, MongoDB database (using in-memory for development, with persistent MongoDB configured in `.env`).
*   **Database Status:**
    *   MongoDB connection established and working (in-memory for dev, persistent setup in `.env`).
    *   Mongoose schemas defined for `User`, `Shipment`, `Invoice`, `Customer`.
    *   Seed script (`seedDb.js`) implemented to populate database on server start (dev mode) with sample data for all core entities.
*   **Authentication & Authorization:**
    *   User model, auth routes (`/login`, `/register`, `/profile`), controllers, and `authenticateToken` middleware are functional. JWTs are used.
    *   `requirePermission` and `requireRole` middleware exist but are temporarily bypassed on most routes for current development focus (all logged-in users have broad access). This needs to be revisited.
    *   JWT secrets are configured in `.env`.
*   **Backend Core Features (API Endpoints):**
    *   **Shipments:** Full CRUD API endpoints implemented.
    *   **Invoices:** Full CRUD API endpoints implemented.
    *   **Users (Drivers):** Full CRUD API endpoints implemented (`/api/users`), separate from auth registration.
    *   **Customers:** Full CRUD API endpoints implemented.
    *   **Reports:**
        *   Driver Commission Report (JSON and PDF) endpoint implemented.
        *   Individual Invoice PDF Report endpoint implemented.
*   **Frontend Core Features (UI & Integration):**
    *   **Authentication Flow:** Login/logout functional. User info displayed.
    *   **Shipments Page:**
        *   Full CRUD functionality with a dedicated form (to be changed to modal).
        *   Inline row-based editing implemented for Status, Customer, and Driver (DDLs).
        *   Shipment details viewable in a modal.
    *   **Invoices Page:**
        *   Lists invoices, allows PDF view.
        *   Full CRUD functionality with a modal form, including customer selection (DDL) and filtering available shipments by customer.
    *   **Driver Commission Reports Page:**
        *   Filters for report generation.
        *   Displays commission data in a table.
        *   PDF download of the report implemented.
        *   "Add New Driver" button (previously on this page) removed; functionality consolidated to Driver Management.
    *   **Driver Management Page (formerly User Management):**
        *   Lists users (including drivers).
        *   Modal form for creating/editing users (including driver-specific fields like commission rate).
        *   Delete/deactivate user functionality.
    *   **Customer Management Page:**
        *   Lists customers.
        *   Modal form for creating/editing customers (including address).
        *   Deactivate customer functionality.
*   **Outstanding Minor Bugs/Issues (as of 2025-06-22):**
    *   Shipments Page: Inline editing dropdowns (Customer, Status, Driver) text might get cut off if options are too wide for the current column `min-width`. (Marked as low priority for now).
*   **General UI/UX:**
    *   Basic styling applied (tables, modals, buttons, forms, status badges).
    *   Action button styles made consistent.
    *   Table cell padding adjusted.
    *   PDF report alignments improved.

## 3. Development Phases

### Phase 1: Establish MongoDB Connection (High Priority)

1.  **Modify `backend/config/database.js`:**
    *   Remove the current PostgreSQL `Pool` configuration.
    *   Add Mongoose connection logic:
        *   Require `mongoose`.
        *   Construct MongoDB connection URI from environment variables (e.g., `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`) or use a single `MONGODB_URI`.
        *   Create an asynchronous function (e.g., `connectDB`) that calls `mongoose.connect()` with the URI and appropriate options.
        *   Include connection success and error logging.
    *   Export the `connectDB` function.
2.  **Update `backend/src/server.js`:**
    *   Import the `connectDB` function from `config/database.js`.
    *   Call `connectDB()` before `app.listen()`.
3.  **Update `backend/.env.example` and Create `.env` File:**
    *   Reflect necessary MongoDB environment variables (e.g., `DB_PORT` default to `27017`).
    *   **Add `JWT_SECRET` and `JWT_REFRESH_SECRET` with strong, unique values.**
    *   The user must create a `.env` file from the example and populate it.

### Phase 2: Verify Authentication and User Management

1.  Once the database connection is working, thoroughly test user registration and login functionality.
2.  Confirm that JWTs are correctly generated, sent to the client, and validated by the `authenticateToken` middleware.
3.  Test role-based access and permissions with `requireRole` and `requirePermission` middleware.

### Phase 3: Develop Core Features (Data Models & API Routes)

For **Shipments, Invoices, and Drivers**:
1.  **Define Mongoose Schemas:** Create detailed schemas for each entity in new files within `backend/src/models/` (e.g., `Shipment.js`, `Invoice.js`, `Driver.js`). Consider relationships.
2.  **Create API Routes:** Define RESTful API endpoints for each entity in new files within `backend/src/routes/` (e.g., `shipments.js`, `invoices.js`, `drivers.js`).
3.  **Implement CRUD Controllers:** Write controller functions for each route (Create, Read, Update, Delete) in new files within `backend/src/controllers/`. Apply authentication/authorization middleware.
4.  **Integrate Routes in `server.js`:** Import and use these new route modules in `backend/src/server.js`.

### Phase 4: Frontend Integration

1.  **API Service:** Update `frontend/src/js/api.js` to include functions for all new backend API endpoints. Handle JWTs.
2.  **Authentication Flow:** Implement the full authentication flow in `frontend/src/js/auth.js` (login, logout, token storage, expiration/refresh).
3.  **UI Development:** Create HTML, CSS, and JavaScript logic in `frontend/src/js/app.js` (and potentially new JS files) to:
    *   Display forms for creating/editing shipments, invoices, drivers.
    *   Show lists/tables of these entities.
    *   Handle user interactions and data display based on roles/permissions.

### Phase 5: Testing and Refinement

1.  **Backend Testing:** Use tools like Postman or automated tests (Jest/Supertest) for all API endpoints.
2.  **Frontend Testing:** Manually test user flows across browsers. Consider frontend unit/integration tests.
3.  **Bug Fixing & UX Improvements:** Address bugs and refine user experience.

## 4. Completed Milestones (Summary)

*   **Phase 1: Establish MongoDB Connection:** DONE.
*   **Phase 2: Verify Authentication and User Management (Initial):** Backend auth is functional. JWT flow established. Basic user model in place.
*   **Phase 3: Develop Core Features (Data Models & API Routes):** DONE. Schemas, routes, and controllers for Shipments, Invoices, Users (including Drivers), and Customers are implemented.
*   **Phase 4: Frontend Integration (Initial Core Features):**
    *   Shipment CRUD (with inline row editing for Status, Customer, Driver; details modal).
    *   Invoice CRUD (listing, PDF view, create/edit modal with customer & shipment selection).
    *   Driver Commission Reports (view, PDF download).
    *   Driver/User Management (listing, create/edit modal, delete/deactivate).
    *   Customer Management (listing, create/edit modal, deactivate).
    *   Basic styling and UX improvements implemented.

## 5. Next Steps for V1 / MVP Polish

1.  **Shipment Creation UX Enhancement (High Priority Client Request):**
    *   Change the "Add New Shipment" on the Shipments page from a full-page form section to a modal overlaying the shipments grid.
2.  **Shipment ID vs. Shipping Number (High Priority Client Request):**
    *   Backend:
        *   Modify `Shipment` model: `shipmentId` becomes an internal, non-editable GUID (auto-generated or UUID).
        *   Add a new field `shippingNumber` (String, user-editable, potentially unique but can be discussed).
    *   Frontend (`shipments.js`, `shipments.html`):
        *   The current "Shipment ID" field in forms and tables becomes "Shipping Number" and is free-text editable (for new) or editable (for existing).
        *   The true `shipmentId` (GUID) is used for API calls but not displayed prominently or editable by users.
    *   Update seed data and all relevant controllers/services.
3.  **Refine "Driver Management" Page (User/Driver CRUD):**
    *   Ensure all necessary fields for managing users who are drivers (e.g., commission rate, truck assignment if that becomes a feature) are easily editable.
    *   Review deactivation vs. deletion logic.
4.  **Enhance "Shipping Details Implementation":**
    *   Review the content and layout of the shipment details modal for completeness and clarity.
    *   Ensure all important fields from the `Shipment` model are displayed logically.
5.  **Styling and UX Improvements (Ongoing):**
    *   Continue to refine the overall look and feel.
    *   Improve form layouts and validation feedback.
    *   Ensure consistent navigation and user experience across all pages.
    *   Address minor UI bugs (e.g., perfect dropdown text visibility in inline edits if still an issue).
6.  **Permissions and Roles (Post-MVP or as part of V1 Polish):**
    *   Define clear roles (e.g., 'manager', 'admin').
    *   Implement and enforce `requirePermission` and `requireRole` middleware rigorously for all API endpoints.
    *   Update seed data to include users with appropriate roles and permissions for testing.
    *   Consider UI changes based on user role (e.g., hiding certain buttons/sections).
7.  **Comprehensive Testing:**
    *   Thorough manual testing of all user flows.
    *   API endpoint testing (e.g., with Postman).
8.  **Documentation:**
    *   Update `README.md` with current setup and run instructions.
    *   Brief user guide for the administrative manager.

## 6. Visual Plan (Mermaid Diagram - Simplified for Current State)

```mermaid
graph TD
    A[Setup & Backend Core Done] --> B[Frontend Core CRUD Implemented];
    B --> C{Client Feedback V1};
    C --> D[Enhance Shipment Add (Modal)];
    D --> E[Refactor Shipment ID vs. Shipping Number];
    E --> F[Refine Driver Management CRUD];
    F --> G[Enhance Shipping Details View];
    G --> H[Ongoing Styling & UX];
    H --> I[Formalize Permissions];
    I --> J[Comprehensive Testing];
    J --> K[V1 Release Candidate];
```