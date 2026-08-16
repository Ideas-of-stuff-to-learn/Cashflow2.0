@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%App\API"
set "FRONTEND_DIR=%SCRIPT_DIR%App\WebUI"
set "ENV_FILE=%SCRIPT_DIR%App\.env"

:: ── Detect local WiFi IP ──────────────────────────────────────────────────────
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /i "IPv4"') do (
    set "CANDIDATE=%%A"
    setlocal enabledelayedexpansion
    set "CANDIDATE=!CANDIDATE: =!"
    :: Skip loopback
    if not "!CANDIDATE!"=="127.0.0.1" (
        if not defined LOCAL_IP (
            endlocal
            set "LOCAL_IP=%%A"
            set "LOCAL_IP=%LOCAL_IP: =%"
        ) else (
            endlocal
        )
    ) else (
        endlocal
    )
)

if not defined LOCAL_IP (
    echo.
    echo ERROR: Could not detect a local IP address.
    echo Make sure you are connected to WiFi and try again.
    echo.
    pause
    exit /b 1
)

echo [config] Detected IP: %LOCAL_IP%

:: ── Write App\.env ────────────────────────────────────────────────────────────
(
    echo VITE_LOCAL_DEV=true
    echo VITE_LOCAL_IP=%LOCAL_IP%
    echo LOCAL_IP=%LOCAL_IP%
) > "%ENV_FILE%"

echo [config] Written %ENV_FILE%

:: ── Launch Flask + Vite ───────────────────────────────────────────────────────
start "Cashflow - Backend" cmd /k "cd /d "%BACKEND_DIR%" && python backend.py"
start "Cashflow - Web Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev -- --host"

echo.
echo Started Backend and Web Frontend.
echo Open your browser at http://%LOCAL_IP%:5173 (or the port Vite prints).
echo.
