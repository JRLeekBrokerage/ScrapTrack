# LeekBrokerage Inc - Trucking Logistics Application

A web-based trucking logistics management system for tracking freight shipments, invoicing reports, and driver commission reports.

## Technology Stack

- **Backend**: Node.js v22.16.0 with Express.js
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Database**: MongoDB
- **Authentication**: JWT tokens

## Project Structure

```
ScrapTrack/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/      # Express middleware
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   └── server.js        # Main server file
│   ├── config/
│   │   └── database.js      # Database configuration
│   ├── .env.example         # Environment variables template
│   └── package.json
├── frontend/                # Vanilla JS frontend
│   ├── src/
│   │   ├── css/
│   │   │   └── styles.css
│   │   ├── js/
│   │   │   ├── api.js       # API communication
│   │   │   ├── auth.js      # Authentication logic
│   │   │   └── app.js       # Main application logic
│   │   └── assets/          # Images, icons, etc.
│   ├── index.html
│   └── package.json
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js v22.16.0 (installed ✓)
- Python 3.13.3 (installed ✓)
- MongoDB (needs to be installed and configured)

### Database Setup (MongoDB)
1. Install MongoDB if not already installed (e.g., MongoDB Community Server).
2. Ensure MongoDB service is running.
3. Create a new database called `leekbrokerage_db` (Mongoose will typically create it on first connection if it doesn't exist, but it's good practice to be aware).
4. If using authentication, create a user with appropriate permissions for this database.

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment template and configure:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your database credentials. For MongoDB, you might use individual parameters as shown or a single `MONGODB_URI` connection string. The current Mongoose setup in `config/database.js` likely uses individual parameters.
   ```
   DB_HOST=localhost
   DB_PORT=27017 # Default MongoDB port
   DB_NAME=leekbrokerage_db
   DB_USER=your_mongodb_username # Optional, if auth is enabled
   DB_PASSWORD=your_mongodb_password # Optional, if auth is enabled
   JWT_SECRET=your_super_secret_key
   # Example MONGODB_URI (if preferred over individual params):
   # MONGODB_URI=mongodb://your_username:your_password@localhost:27017/leekbrokerage_db?authSource=admin
   ```

5. Start the backend server:
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:3000`

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the frontend server:
   ```bash
   npm run serve
   ```
   The application will be available at `http://localhost:3001`

## Features

### Current Features
- Home screen with LeekBrokerage branding
- User authentication (mock implementation)
- Dashboard with navigation
- Responsive design

### Planned Features
- **Freight Shipments**: Track and manage freight shipments
- **Invoicing Reports**: Generate and view invoicing reports
- **Driver Commission**: Manage driver commission calculations and reports

## Development

### Running in Development Mode
1. Start the backend: `cd backend && npm run dev`
2. Start the frontend: `cd frontend && npm run serve`

### API Endpoints
- `GET /api/health` - Health check
- `POST /api/auth/login` - User login (to be implemented)
- `POST /api/auth/logout` - User logout (to be implemented)
- Additional endpoints will be added for shipments, invoices, and drivers

## Next Steps

1. **Database Schema**: Design and implement database tables
2. **Authentication**: Implement proper JWT authentication
3. **API Routes**: Create CRUD operations for shipments, invoices, and drivers
4. **Frontend Integration**: Connect frontend to real API endpoints
5. **Data Models**: Create data models for the core business objects

## Contributing

This is a private application for LeekBrokerage Inc. Please follow the established coding standards and test all changes before committing.

## License

Private - LeekBrokerage Inc