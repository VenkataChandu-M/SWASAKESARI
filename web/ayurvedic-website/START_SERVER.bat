@echo off
title Sampurna Ayurvedic Server
echo ========================================
echo   Sampurna Ayurvedic Website Server
echo ========================================
echo.
echo Starting server with authentication...
echo.

python "%~dp0start.py"

if errorlevel 1 (
    echo.
    echo ERROR: Python is required. Please install Python 3.8+
    echo Download: https://www.python.org/downloads/
    pause
)
