@echo off
setlocal
title Hotel Booking - Start Web

cd /d "%~dp0"
echo ==========================================
echo   Starting Hotel Booking web application
echo ==========================================
echo.
echo If this is your first run, install dependencies with:
echo   npm install
echo   cd backend ^&^& npm install
echo   cd ..\frontend\my-hotel-app ^&^& npm install
echo.

npm run start

echo.
echo Application stopped. Press any key to close...
pause >nul
