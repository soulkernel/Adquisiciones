@echo off
cd /d "%~dp0"
start "Servidor GLF" powershell.exe -NoExit -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8770/?v=20260713-9"
