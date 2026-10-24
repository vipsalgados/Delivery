@echo off
chcp 65001 >nul
title Salgados VIP - Servico WhatsApp Silencioso
:: Inicia o servico de WhatsApp de forma 100% oculta em segundo plano (Zero Janelas)
start "" wscript.exe "%~dp0Iniciar_WhatsApp_Oculto.vbs"
exit
