@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "LANDING_DIR=%SCRIPT_DIR%landing"

if not exist "%LANDING_DIR%\node_modules" (
    echo [setup] node_modules not found -- running npm install first...
    cd /d "%LANDING_DIR%"
    npm install
)

start "utility-tools - Landing Page" cmd /k "cd /d "%LANDING_DIR%" && npm run dev"

echo.
echo Started Landing Page dev server.
echo Open your browser at http://localhost:5174
echo.
