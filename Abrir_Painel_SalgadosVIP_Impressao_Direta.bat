@echo off
chcp 65001 >nul
title Salgados VIP - Inicializador de Impressao Direta (Zero Janelas)
cls
echo ===============================================================================
echo     SALGADOS VIP DELIVERY - INICIALIZADOR COM IMPRESSAO DIRETA SILENCIOSA
echo ===============================================================================
echo.
echo [*] Este inicializador abre o Painel Administrativo em modo Kiosk Printing.
echo [*] Qualquer pedido novo sera impresso DIRETO na impressora padrao deste PC,
echo [*] com ZERO caixas de dialogo, ZERO confirmacoes e sem travar a tela.
echo.

set "TARGET_URL=http://localhost:5500/admin.html"
if exist "%~dp0admin.html" (
    set "TARGET_URL=%~dp0admin.html"
)

:: 1. Tenta abrir no Google Chrome
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    echo [*] Abrindo no Google Chrome (Modo Impressao Silenciosa)...
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --kiosk-printing --app="%TARGET_URL%"
    goto :FIM
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    echo [*] Abrindo no Google Chrome (x86) (Modo Impressao Silenciosa)...
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --kiosk-printing --app="%TARGET_URL%"
    goto :FIM
)

:: 2. Tenta abrir no Microsoft Edge
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    echo [*] Abrindo no Microsoft Edge (Modo Impressao Silenciosa)...
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --app="%TARGET_URL%"
    goto :FIM
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    echo [*] Abrindo no Microsoft Edge (Modo Impressao Silenciosa)...
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --app="%TARGET_URL%"
    goto :FIM
)

:: 3. Fallback padrao
echo [*] Abrindo navegador padrao do Windows...
start "" "%TARGET_URL%"

:FIM
echo.
echo [OK] Painel administrativo aberto com sucesso!
timeout /t 3 >nul
exit
