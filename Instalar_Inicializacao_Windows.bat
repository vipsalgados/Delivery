@echo off
chcp 65001 >nul
title Salgados VIP - Instalar Inicializacao Automatica com o Windows
cls
echo =====================================================================
echo    SALGADOS VIP - INSTALADOR DE INICIALIZACAO COM O WINDOWS
echo =====================================================================
echo.
echo Este assistente configura o Agente de Impressao Silenciosa para rodar
echo automaticamente sempre que este computador for ligado.
echo.
echo Os pedidos que chegarem serao impressos na impressora padrao
echo mesmo que o navegador ou o aplicativo nao estejam abertos!
echo.
pause

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SCRIPT="%TEMP%\create_vip_print_startup.vbs"
if exist %SCRIPT% del %SCRIPT%

echo Set oWS = WScript.CreateObject("WScript.Shell") >> %SCRIPT%
echo sLinkFile = "%STARTUP_DIR%\Salgados VIP - Impressao Silenciosa.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "wscript.exe" >> %SCRIPT%
echo oLink.Arguments = Chr(34) ^& "%~dp0Iniciar_Impressao_Oculto.vbs" ^& Chr(34) >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink.Description = "Salgados VIP - Impressao Silenciosa Automatica em Segundo Plano" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

cscript /nologo %SCRIPT%
if exist %SCRIPT% del %SCRIPT%

echo.
echo [+] SUCESSO! Atalho instalado na Inicializacao do Windows:
echo     "%STARTUP_DIR%\Salgados VIP - Impressao Silenciosa.lnk"
echo.
echo [*] Iniciando o agente de impressao agora em segundo plano...
start "" wscript.exe "%~dp0Iniciar_Impressao_Oculto.vbs"
echo.
echo O servico ja esta ativo e rodando!
echo.
timeout /t 5 >nul
exit
