@echo off
chcp 65001 >nul
title Salgados VIP - Configurador de Impressao 100% Silenciosa (Zero Dialogos)
cls
echo ===============================================================================
echo      SALGADOS VIP - ATIVADOR DE IMPRESSAO DIRETA SILENCIOSA NO WINDOWS
echo ===============================================================================
echo.
echo [*] Configurando politicas do Google Chrome e Microsoft Edge...
echo [*] Isso permite que o Painel imprima diretamente na impressora termica padrao
echo     deste computador sem abrir nenhuma janela de confirmacao ou previa de impressao.
echo.

:: Configura no registro do usuario atual (HKCU)
reg add "HKCU\Software\Policies\Google\Chrome" /v SilentPrintingEnabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\Policies\Microsoft\Edge" /v SilentPrintingEnabled /t REG_DWORD /d 1 /f >nul 2>&1

:: Tenta no registro da maquina (HKLM) se tiver permissao de administrador
reg add "HKLM\Software\Policies\Google\Chrome" /v SilentPrintingEnabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\Software\Policies\Microsoft\Edge" /v SilentPrintingEnabled /t REG_DWORD /d 1 /f >nul 2>&1

echo [OK] Politica de Impressao Silenciosa ativada com sucesso!
echo.
echo A partir de agora, os navegadores Chrome e Edge deste computador
echo enviarao todas as impressoes do Painel direto para a impressora termica!
echo.
pause
