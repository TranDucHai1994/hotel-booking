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
echo [1/3] Kiem tra va tat process cu tren cac port...

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

:: --- Khoi dong Backend ---
echo.
echo [2/3] Khoi dong Backend (port 4000)...
start "Hotel Booking - Backend :4000" cmd /k "title Hotel Booking - Backend :4000 && cd /d "%~dp0backend" && node server.js"

:: Cho backend khoi dong truoc
timeout /t 3 /nobreak >nul

:: --- Khoi dong Frontend ---
echo [3/3] Khoi dong Frontend (port 3001)...
start "Hotel Booking - Frontend :3005" cmd /k "title Hotel Booking - Frontend :3005 && cd /d "%~dp0frontend\my-hotel-app" && SET PORT=3005 && npm start"

echo.
echo ==========================================
echo   Da mo 2 cua so cho Backend va Frontend.
echo   Backend : http://localhost:4000
echo   Frontend: http://localhost:3005
echo.
echo   De dung: dong 2 cua so do lai.
echo ==========================================
echo.
pause >nul
