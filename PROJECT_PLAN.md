# LeekBrokerage Inc - Trucking Logistics Application: Development Plan

## 1. Overview

This document outlines the development plan for completing the LeekBrokerage Inc trucking logistics application. The application uses a Node.js/Express backend, a Vanilla JavaScript frontend, and MongoDB as the database.

## 2. Current Status Summary

*   **Project Goal:** A trucking logistics management system.
*   **Technology Stack:** Node.js/Express backend, Vanilla JS frontend, MongoDB database.
*   **Database Status:**
    *   Decision made to use MongoDB.
    *   `README.md` updated to reflect MongoDB.
    *   **Critical Issue:** The backend is **not currently configured to connect to MongoDB**.
*   **Authentication & Authorization:**
    *   User model, auth routes, controllers, and middleware are largely in place and well-developed.
    *   **JWT secrets need to be configured in `.env`**.
*   **Core Features (Shipments, Invoices, Drivers):** Planned but not yet implemented.
*   **Frontend:** Basic structure exists; needs integration with backend APIs.

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

## 4. Visual Plan (Mermaid Diagram)

```mermaid
graph TD
    A[Start: Assess App] --> B{DB Mismatch?};
    B -- Yes --> C[Decide DB: MongoDB];
    C --> D[Update README for MongoDB - Done];
    D --> E{DB Connection Configured?};
    E -- No --> Phase1_Fix_DB_Connection;

    subgraph Phase1_Fix_DB_Connection [Phase 1: Fix DB Connection]
        direction LR
        F1[Modify backend/config/database.js for Mongoose] --> F2[Update backend/src/server.js to call connectDB];
        F2 --> F3[Update .env.example & .env for MongoDB & JWT Secrets];
        F3 --> F4[Test DB Connection];
    end

    Phase1_Fix_DB_Connection --> G[DB Connection Working];

    subgraph Phase2_Verify_Auth [Phase 2: Verify Authentication]
        direction LR
        G --> H1[Review auth middleware - Done];
        H1 --> H2[Test Register/Login];
        H2 --> H3[Verify JWT Flow & Permissions];
    end
    
    Phase2_Verify_Auth --> I[Auth System Verified];

    subgraph Phase3_Core_Features [Phase 3: Develop Core Features]
        direction TB
        I --> J1[Define Mongoose Schemas (Shipments, Invoices, Drivers)];
        J1 --> J2[Create API Routes & CRUD Controllers w/ AuthZ];
        J2 --> J3[Integrate Routes in server.js];
    end

    Phase3_Core_Features --> K[Core Backend Features Implemented];

    subgraph Phase4_Frontend_Integration [Phase 4: Frontend Integration]
        direction TB
        K --> L1[Update frontend/src/js/api.js];
        L1 --> L2[Implement frontend/src/js/auth.js logic];
        L2 --> L3[Develop UI for Core Features];
    end
    
    Phase4_Frontend_Integration --> M[Frontend Integrated];
    M --> N[Phase 5: Testing & Refinement];
    N --> O[App Complete];