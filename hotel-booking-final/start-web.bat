@echo off
setlocal
title Hotel Booking - Manager

cd /d "%~dp0"

echo ==========================================
echo   Hotel Booking - Khoi dong du an
echo   Backend : http://localhost:4000
echo   Frontend: http://localhost:3005
echo ==========================================
echo.

:: --- Tat process cu dang chiem port cua project nay ---
echo [1/2] Kiem tra va tat process cu tren cac port...

set KILLED=0
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr " :4000 "') do (
    if not "%%a"=="0" (
        taskkill /F /PID %%a >nul 2>&1
        if not errorlevel 1 (
            echo   - Da tat process PID %%a tren port 4000
            set KILLED=1
        )
    )
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr " :3005 "') do (
    if not "%%a"=="0" (
        taskkill /F /PID %%a >nul 2>&1
        if not errorlevel 1 (
            echo   - Da tat process PID %%a tren port 3005
            set KILLED=1
        )
    )
)
if "%KILLED%"=="0" echo   (Khong co process nao can tat)

:: Cho he thong giai phong port
timeout /t 1 /nobreak >nul

:: --- Kiem tra thu muc ---
if not exist "%~dp0backend\server.js" (
    echo.
    echo [LOI] Khong tim thay backend\server.js
    echo Chay bat file nay tu thu muc goc cua project.
    pause
    exit /b 1
)
if not exist "%~dp0frontend\my-hotel-app\package.json" (
    echo.
    echo [LOI] Khong tim thay frontend\my-hotel-app\package.json
    pause
    exit /b 1
)

:: --- Khoi dong Backend + Frontend trong cung 1 cua so (concurrently) ---
echo.
echo [2/2] Khoi dong Backend + Frontend...
echo   (Ca hai chay chung trong cua so nay, log phan biet mau)
echo   De dung: nhan Ctrl+C trong cua so nay.
echo ==========================================
echo.
call npm start
