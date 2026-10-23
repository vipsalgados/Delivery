@echo off
chcp 65001 >nul
echo ========================================================
echo   PUBLICADOR AUTOMÁTICO GITHUB - SALGADOS VIP
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Subir_Para_GitHub.ps1"
pause
