@echo off
chcp 65001 >nul
title Salgados VIP - Inicializador PDV com Impressão Silenciosa (Zero Diálogos)
cls
echo =====================================================================
echo    SALGADOS VIP - PAINEL ADM COM IMPRESSAO DIRETA SILENCIOSA
echo =====================================================================
echo.
echo [*] 1. Iniciando Agente de Impressao Silenciosa do Windows...
start /min "" cmd /c "%~dp0Servico_Impressao_Silenciosa.bat"

echo [*] 2. Configurando perfil isolado de Kiosk Printing...
set CURRENT_DIR=%~dp0
set TARGET_URL=file:///%CURRENT_DIR:\=/%admin.html
set USER_DATA_DIR=%LOCALAPPDATA%\SalgadosVIP_PDV

if not exist "%USER_DATA_DIR%" mkdir "%USER_DATA_DIR%"

echo [*] 3. Abrindo Painel em modo PDV Kiosk (Zero Telas de Confirmacao)...

:: 1. Tenta Google Chrome com perfil isolado e kiosk-printing
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    echo [+] Iniciando via Google Chrome (Kiosk)...
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-extensions --app="%TARGET_URL%"
    goto :FIM
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    echo [+] Iniciando via Google Chrome x86 (Kiosk)...
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-extensions --app="%TARGET_URL%"
    goto :FIM
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    echo [+] Iniciando via Google Chrome User (Kiosk)...
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-extensions --app="%TARGET_URL%"
    goto :FIM
)

:: 2. Tenta Microsoft Edge com perfil isolado e kiosk-printing
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    echo [+] Iniciando via Microsoft Edge (Kiosk)...
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-extensions --app="%TARGET_URL%"
    goto :FIM
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    echo [+] Iniciando via Microsoft Edge x64 (Kiosk)...
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-extensions --app="%TARGET_URL%"
    goto :FIM
)

:: 3. Fallback
start msedge --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --app="%TARGET_URL%"

:FIM
timeout /t 2 >nul
exit
