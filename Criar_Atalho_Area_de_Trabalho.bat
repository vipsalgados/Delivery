@echo off
chcp 65001 >nul
title Salgados VIP - Criar Atalhos na Área de Trabalho
cls
echo =====================================================================
echo    SALGADOS VIP - CRIANDO ATALHOS NA ÁREA DE TRABALHO
echo =====================================================================
echo.
set SCRIPT="%TEMP%\create_vip_shortcuts.vbs"
if exist %SCRIPT% del %SCRIPT%

echo Set oWS = WScript.CreateObject("WScript.Shell") >> %SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\Salgados VIP - Painel PDV.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "%~dp0Abrir_Painel_Impressao_Silenciosa.bat" >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink.Description = "Salgados VIP - Painel com Impressao Silenciosa" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

echo sLinkFile2 = oWS.SpecialFolders("Desktop") ^& "\Salgados VIP - WhatsApp Silencioso.lnk" >> %SCRIPT%
echo Set oLink2 = oWS.CreateShortcut(sLinkFile2) >> %SCRIPT%
echo oLink2.TargetPath = "%~dp0Servico_WhatsApp_Silencioso.bat" >> %SCRIPT%
echo oLink2.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink2.Description = "Salgados VIP - Robô de WhatsApp Silencioso (Zero Janelas)" >> %SCRIPT%
echo oLink2.Save >> %SCRIPT%

cscript /nologo %SCRIPT%
if exist %SCRIPT% del %SCRIPT%

echo [+] Atalhos criados com sucesso na sua Área de Trabalho:
echo     1. Salgados VIP - Painel PDV.lnk
echo     2. Salgados VIP - WhatsApp Silencioso.lnk
echo.
echo Basta clicar duas vezes neles para iniciar o Painel e o Robô de WhatsApp!
echo.
timeout /t 4 >nul
