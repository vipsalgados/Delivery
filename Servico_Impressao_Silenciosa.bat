@echo off
chcp 65001 >nul
title Salgados VIP - Servico de Impressao Silenciosa Local (Zero Dialogos)
cls
echo =====================================================================
echo    SALGADOS VIP - SERVICO DE IMPRESSAO SILENCIOSA (WINDOWS)
echo =====================================================================
echo.
echo [*] Iniciando agente de impressao em segundo plano...
echo [*] Este servico imprime direto no Spooler do Windows (porta 18181)
echo [*] e monitora pedidos da nuvem mesmo com o navegador fechado!
echo.

where py >nul 2>nul
if %errorlevel% equ 0 (
    py "%~dp0Agente_Impressao_Silenciosa.py"
    goto :FIM
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    python "%~dp0Agente_Impressao_Silenciosa.py"
    goto :FIM
)

echo [*] Python nao encontrado no PATH. Usando motor PowerShell...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0Servico_Impressao_Silenciosa.ps1"

:FIM
if %errorlevel% neq 0 (
    echo.
    echo [!] O servico foi encerrado ou encontrou um erro.
    pause
)
