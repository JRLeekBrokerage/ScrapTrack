@echo off
echo "Starting backend server in production mode..."
start "Backend" cmd /k "cd backend && set NODE_ENV=production&& npm start"

echo "Starting frontend server..."
start "Frontend" cmd /k "cd frontend && npm run serve"