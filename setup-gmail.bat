@echo off
echo ========================================
echo   GMAIL APP PASSWORD SETUP GUIDE
echo ========================================
echo.
echo 🔐 To send real emails, you need a Gmail App Password
echo.
echo 📋 Steps to create Gmail App Password:
echo.
echo 1. Go to: https://myaccount.google.com/security
echo 2. Make sure 2-Factor Authentication is ON
echo 3. Go to: https://myaccount.google.com/apppasswords
echo 4. Select "Mail" and generate password
echo 5. Copy the 16-character password (remove spaces)
echo 6. Update .env file with your App Password
echo.
echo 💡 Current email config:
echo    EMAIL_USER: nghiaht28102003@gmail.com
echo    EMAIL_PASS: [needs App Password]
echo.
echo 🧪 After updating .env, test with:
echo    node test-email-config.js
echo.
echo ⚠️  IMPORTANT: Never share your App Password!
echo.
pause
