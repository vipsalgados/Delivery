@echo off
chcp 65001 >nul
title Salgados VIP - Criar Atalho do WhatsApp Silencioso
cls
echo =====================================================================
echo    SALGADOS VIP - CRIANDO ATALHO NA ÁREA DE TRABALHO
echo =====================================================================
echo.
set SCRIPT="%TEMP%\create_vip_wa_shortcut.vbs"
if exist %SCRIPT% del %SCRIPT%

echo Set oWS = WScript.CreateObject("WScript.Shell") >> %SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\Salgados VIP - WhatsApp Silencioso.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "%~dp0Servico_WhatsApp_Silencioso.bat" >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink.Description = "Salgados VIP - Robô de WhatsApp Silencioso (Zero Janelas)" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

cscript /nologo %SCRIPT%
if exist %SCRIPT% del %SCRIPT%

echo [+] Atalho 'Salgados VIP - WhatsApp Silencioso' criado na sua Área de Trabalho!
echo.
echo Basta clicar duas vezes nele na sua Área de Trabalho para iniciar o robô!
echo.
timeout /t 4 >nul
