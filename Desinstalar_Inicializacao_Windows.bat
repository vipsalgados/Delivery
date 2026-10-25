@echo off
chcp 65001 >nul
title Salgados VIP - Desinstalar Inicializacao com o Windows
cls
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set LNK_FILE="%STARTUP_DIR%\Salgados VIP - Impressao Silenciosa.lnk"

if exist %LNK_FILE% (
    del %LNK_FILE%
    echo [+] Atalho de inicializacao com o Windows removido com sucesso!
) else (
    echo [*] O atalho de inicializacao nao estava presente.
)

timeout /t 3 >nul
exit
