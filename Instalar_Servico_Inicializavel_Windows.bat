@echo off
chcp 65001 >nul
title Salgados VIP - Instalar Servico de WhatsApp Silencioso no Windows
cls
echo =====================================================================
echo    SALGADOS VIP - INSTALACAO DO SERVICO DE WHATSAPP SILENCIOSO
echo =====================================================================
echo.
echo [*] Configurando inicializacao automatica com o Windows...
echo [*] Modo: 100%% Oculto em Segundo Plano (Zero Janelas Abertas)
echo.

set "SCRIPT_DIR=%~dp0"
:: Remove barra invertida final se existir
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

:: 1. Registra o protocolo salgadosvip-wa no Registro do Windows (HKCU - Nao exige admin)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$key = 'HKCU:\Software\Classes\salgadosvip-wa';" ^
  "New-Item -Path $key -Force | Out-Null;" ^
  "Set-ItemProperty -Path $key -Name '(default)' -Value 'URL:Salgados VIP WhatsApp Protocol';" ^
  "Set-ItemProperty -Path $key -Name 'URL Protocol' -Value '';" ^
  "$cmdKey = \"$key\shell\open\command\";" ^
  "New-Item -Path $cmdKey -Force | Out-Null;" ^
  "$vbs = Join-Path '%SCRIPT_DIR%' 'Iniciar_WhatsApp_Oculto.vbs';" ^
  "Set-ItemProperty -Path $cmdKey -Name '(default)' -Value \"wscript.exe `\"$vbs`\" `\"%1`\"\";"

echo [+] 1. Protocolo do navegador 'salgadosvip-wa:' registrado com sucesso!

:: 2. Registra na pasta de Inicializacao do Windows (shell:startup)
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SalgadosVIP_WhatsApp_Silencioso.vbs"
(
echo ' Salgados VIP - Inicializacao Automatica com o Windows
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.Run "wscript.exe ""%SCRIPT_DIR%\Iniciar_WhatsApp_Oculto.vbs""", 0, False
echo Set WshShell = Nothing
) > "%STARTUP_VBS%"

echo [+] 2. Inicializacao automatica com o Windows ativada em Startup!

:: 3. Inicia o servico imediatamente em segundo plano via Explorer
start "" explorer.exe "salgadosvip-wa:start"
echo [+] 3. Servico iniciado agora mesmo em segundo plano (porta 18182)!
echo.
echo =====================================================================
echo    INSTALACAO CONCLUIDA COM SUCESSO!
echo =====================================================================
echo [*] O robo agora:
echo     - Inicia automaticamente sempre que o computador for ligado.
echo     - Roda 100%% oculto sem nenhuma janela aberta na tela.
echo     - Pode ser acionado com 1 clique direto no Painel Administrativo.
echo.
ping 127.0.0.1 -n 4 >nul
exit
