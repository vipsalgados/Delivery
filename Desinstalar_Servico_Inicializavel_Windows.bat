@echo off
chcp 65001 >nul
title Salgados VIP - Desinstalar Servico de WhatsApp Silencioso
cls
echo =====================================================================
echo    SALGADOS VIP - DESINSTALACAO DO SERVICO DE WHATSAPP
echo =====================================================================
echo.

:: 1. Remove da pasta de inicializacao
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SalgadosVIP_WhatsApp_Silencioso.vbs"
if exist "%STARTUP_VBS%" (
    del "%STARTUP_VBS%"
    echo [+] 1. Inicializacao automatica removida da pasta Startup!
)

:: 2. Remove o protocolo registrado
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "if (Test-Path 'HKCU:\Software\Classes\salgadosvip-wa') { Remove-Item -Path 'HKCU:\Software\Classes\salgadosvip-wa' -Recurse -Force; }"
echo [+] 2. Protocolo do navegador 'salgadosvip-wa:' removido!

:: 3. Encerra o servico na porta 18182 se estiver ativo
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { Invoke-RestMethod -Uri 'http://127.0.0.1:18182/stop' -Method Post -TimeoutSec 2 | Out-Null } catch {}"
echo [+] 3. Processos do servico encerrados.
echo.
echo [*] Desinstalacao concluida.
ping 127.0.0.1 -n 3 >nul
exit
