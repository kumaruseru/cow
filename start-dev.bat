@echo off
echo 🐄 COW SOCIAL NETWORK - DEVELOPMENT STARTUP SCRIPT
echo ==================================================

REM Check Node.js version
echo ℹ️ Checking Node.js version...
node --version
echo ✅ Node.js is available

REM Check if .env file exists
if exist ".env" (
    echo ✅ .env file found
) else (
    echo ⚠️ .env file not found, copying from .env.example
    copy .env.example .env
    echo ℹ️ Please edit .env file with your configuration
)

REM Create necessary directories
echo ℹ️ Creating necessary directories...
if not exist "uploads\profile-images" mkdir uploads\profile-images
if not exist "uploads\posts" mkdir uploads\posts
if not exist "logs" mkdir logs
echo ✅ Directories created

REM Install dependencies if needed
if not exist "node_modules" (
    echo ℹ️ Installing dependencies...
    npm install
    echo ✅ Dependencies installed
) else (
    echo ✅ Dependencies already installed
)

REM Run security audit
echo ℹ️ Running security audit...
npm audit --audit-level=moderate

REM Start the server
echo ℹ️ Starting Cow Social Network server...
echo.
echo 🚀 Server will be available at: http://localhost:3000
echo 📝 Login page: http://localhost:3000/login
echo 📝 Register page: http://localhost:3000/register  
echo 📱 Main app: http://localhost:3000/index.html
echo.
echo ✅ Starting server in development mode...

REM Start with nodemon if available, otherwise use node
where nodemon >nul 2>nul
if %ERRORLEVEL% == 0 (
    nodemon server.js
) else (
    node server.js
)
