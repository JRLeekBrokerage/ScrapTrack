@echo off
echo "Starting backend server..."
start "Backend" cmd /k "cd backend && npm start"

echo "Starting frontend server..."
start "Frontend" cmd /k "cd frontend && npm start"