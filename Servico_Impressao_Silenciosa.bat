@echo off
chcp 65001 >nul
title Salgados VIP - Servico de Impressao Silenciosa Local (Zero Dialogos)
cls
echo =====================================================================
echo    SALGADOS VIP - SERVICO DE IMPRESSAO SILENCIOSA (WINDOWS)
echo =====================================================================
echo.
echo [*] Iniciando servidor local na porta 18181...
echo [*] Este servico permite imprimir direto no Spooler do Windows
echo [*] SEM abrir nenhuma janela do navegador ou pedir confirmacao.
echo.
echo Mantenha esta janela minimizada durante o expediente.
echo.

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0Servico_Impressao_Silenciosa.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [!] O servico foi encerrado ou encontrou um erro.
    pause
)
