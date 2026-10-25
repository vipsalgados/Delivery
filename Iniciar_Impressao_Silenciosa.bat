@echo off
chcp 65001 >nul
title Salgados VIP - Iniciar Impressao Silenciosa
:: Inicia o agente de impressao de forma 100% oculta em segundo plano (Zero Janelas)
start "" wscript.exe "%~dp0Iniciar_Impressao_Oculto.vbs"
exit
