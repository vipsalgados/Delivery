@echo off
chcp 65001 >nul
title Salgados VIP - Servico de Impressao Silenciosa (Zero Dialogos)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$script = (Get-Content -LiteralPath '%~f0' | Select-Object -Skip 6) -join [Environment]::NewLine; Invoke-Expression $script"
exit /b %errorlevel%

# ==============================================================================
# SALGADOS VIP - MOTOR AUTOMATICO DE IMPRESSAO SILENCIOSA DIRETA (WINDOWS)
# RODA 100% NATIVO EM QUALQUER WINDOWS 10 / 11 SEM PYTHON E SEM ARQUIVOS EXTERNOS!
# ==============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$appDataDir = Join-Path $env:LOCALAPPDATA "SalgadosVIP"
if (-not (Test-Path $appDataDir)) { New-Item -ItemType Directory -Path $appDataDir -Force | Out-Null }

Write-Host "=================================================================" -ForegroundColor Green
Write-Host "   SALGADOS VIP - ATIVADOR DE IMPRESSAO SILENCIOSA (WINDOWS)     " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""

# 1. Configurar politicas do Chrome e Edge para desativar a janela de confirmacao de impressao
Write-Host "[*] 1/4 Configurando politicas do Windows para impressao direta sem janelas..." -ForegroundColor Cyan
try {
    $chromePolicy = "HKCU:\Software\Policies\Google\Chrome"
    if (-not (Test-Path $chromePolicy)) { New-Item -Path $chromePolicy -Force | Out-Null }
    Set-ItemProperty -Path $chromePolicy -Name "PrintPreviewDisabled" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path $chromePolicy -Name "PrintingEnabled" -Value 1 -Type DWord -Force

    $edgePolicy = "HKCU:\Software\Policies\Microsoft\Edge"
    if (-not (Test-Path $edgePolicy)) { New-Item -Path $edgePolicy -Force | Out-Null }
    Set-ItemProperty -Path $edgePolicy -Name "PrintPreviewDisabled" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path $edgePolicy -Name "PrintingEnabled" -Value 1 -Type DWord -Force
    Write-Host "    [OK] Janela de previa do navegador desativada permanentemente." -ForegroundColor Green
} catch {
    Write-Host "    [!] Aviso ao gravar chaves de registro: $_" -ForegroundColor Yellow
}

# 2. Criar Atalho na Area de Trabalho com Modo Kiosk Silencioso
Write-Host "[*] 2/4 Criando Atalho 'Salgados VIP - Painel PDV' na Area de Trabalho..." -ForegroundColor Cyan
$targetUrl = "https://vipsalgados.github.io/Delivery/admin.html"
$userDataDir = Join-Path $env:LOCALAPPDATA "SalgadosVIP_PDV"

$browserExe = ""
$paths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
foreach ($p in $paths) {
    if (Test-Path $p) { $browserExe = $p; break }
}
if (-not $browserExe) { $browserExe = "msedge.exe" }

try {
    $wsh = New-Object -ComObject WScript.Shell
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = Join-Path $desktopPath "Salgados VIP - Painel PDV.lnk"
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $browserExe
    $shortcut.Arguments = "--kiosk-printing --user-data-dir=`"$userDataDir`" --app=`"$targetUrl`""
    $shortcut.WorkingDirectory = $desktopPath
    $shortcut.Description = "Salgados VIP - Painel Administrativo PDV com Impressao Silenciosa"
    $shortcut.Save()
    Write-Host "    [OK] Atalho criado na sua Area de Trabalho com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "    [!] Erro ao criar atalho: $_" -ForegroundColor Yellow
}

# 3. Registrar na Inicializacao do Windows (Startup)
Write-Host "[*] 3/4 Configurando inicializacao automatica ao ligar o computador..." -ForegroundColor Cyan
try {
    $startupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
    $myPath = $MyInvocation.MyCommand.Path
    if (-not $myPath) { $myPath = Join-Path $appDataDir "Servico_Impressao_Silenciosa.bat" }

    $permanentBat = Join-Path $appDataDir "Servico_Impressao_Silenciosa.bat"
    if (Test-Path $myPath) {
        Copy-Item -Path $myPath -Destination $permanentBat -Force -ErrorAction SilentlyContinue
    }

    $startupVbs = Join-Path $startupDir "SalgadosVIP_Impressao_Silenciosa.vbs"
    $vbsContent = "Set WshShell = CreateObject(`"WScript.Shell`")`nWshShell.Run Chr(34) & `"$permanentBat`" & Chr(34), 0, False"
    Set-Content -Path $startupVbs -Value $vbsContent -Encoding UTF8
    Write-Host "    [OK] Inicializacao automatica configurada na pasta Startup." -ForegroundColor Green
} catch {
    Write-Host "    [!] Aviso na inicializacao: $_" -ForegroundColor Yellow
}

# 4. Iniciar Servidor de Spooler Local na Porta 18181
Write-Host "[*] 4/4 Iniciando Servidor de Impressao Silenciosa (Porta 18181)..." -ForegroundColor Cyan
$port = 18181
$listener = $null

$isOpen = $false
try {
    $tcp = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($tcp) { $isOpen = $true }
} catch {}

if ($isOpen) {
    Write-Host "    [OK] O servico ja esta ativo e pronto na porta 18181!" -ForegroundColor Green
} else {
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://127.0.0.1:$port/")
        $listener.Start()
        Write-Host "    [OK] Servidor de impressao ativo em http://127.0.0.1:$port/ !" -ForegroundColor Green
    } catch {
        Write-Host "    [!] Erro ao abrir porta $port : $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host " [SUCESSO TOTAL] TUDO PRONTO PARA IMPRIMIR NO AUTOMATICO!" -ForegroundColor Green
Write-Host " 1. Use o atalho 'Salgados VIP - Painel PDV' na Area de Trabalho." -ForegroundColor Cyan
Write-Host " 2. Ele abre com KIOSK PRINTING: envio direto sem caixas de dialogo!" -ForegroundColor Cyan
Write-Host " 3. Mantenha esta janela minimizada durante o expediente." -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""

if ($listener -and $listener.IsListening) {
    Start-Process $browserExe "--kiosk-printing --user-data-dir=`"$userDataDir`" --app=`"$targetUrl`"" -ErrorAction SilentlyContinue

    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response

            $origin = $request.Headers["Origin"]
            if ($origin) {
                $response.AddHeader("Access-Control-Allow-Origin", $origin)
            } else {
                $response.AddHeader("Access-Control-Allow-Origin", "*")
            }
            $response.AddHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, X-VIP-Token, Authorization")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }

            if ($request.HttpMethod -eq "GET" -and $request.Url.LocalPath -eq "/status") {
                $defaultPrinter = (Get-CimInstance Win32_Printer | Where-Object Default -eq $true | Select-Object -ExpandProperty Name)
                $installed = @(Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name)
                $respObj = @{
                    status = "online"
                    online = $true
                    defaultPrinter = $defaultPrinter
                    installedPrinters = $installed
                } | ConvertTo-Json
                $buf = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buf.Length
                $response.OutputStream.Write($buf, 0, $buf.Length)
                $response.OutputStream.Close()
                continue
            }

            if ($request.HttpMethod -eq "GET" -and $request.Url.LocalPath -eq "/ping") {
                $respObj = @{ online = $true; service = "Salgados VIP Spooler" } | ConvertTo-Json
                $buf = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buf.Length
                $response.OutputStream.Write($buf, 0, $buf.Length)
                $response.OutputStream.Close()
                continue
            }

            if ($request.HttpMethod -eq "POST" -and $request.Url.LocalPath -eq "/print") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $json = ConvertFrom-Json $body
                $receiptText = if ($json.receiptText) { $json.receiptText } else { $json.text }
                $orderId = if ($json.orderId) { $json.orderId } else { "MANUAL" }
                $printerName = $json.printerName
                $copies = if ($json.copies) { [int]$json.copies } else { 1 }

                Write-Host "[+] Imprimindo pedido $orderId ($copies via(s))..." -ForegroundColor Cyan
                $tempFile = [System.IO.Path]::GetTempFileName() + ".txt"
                [System.IO.File]::WriteAllText($tempFile, $receiptText, [System.Text.Encoding]::GetEncoding(1252))

                for ($i = 1; $i -le $copies; $i++) {
                    if ($printerName -and $printerName -ne "windows_default") {
                        Get-Content -LiteralPath $tempFile | Out-Printer -Name $printerName
                    } else {
                        Get-Content -LiteralPath $tempFile | Out-Printer
                    }
                }
                Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

                $respObj = @{ success = $true; orderId = $orderId; message = "Impresso com sucesso via Spooler." } | ConvertTo-Json
                $buf = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buf.Length
                $response.OutputStream.Write($buf, 0, $buf.Length)
                $response.OutputStream.Close()
            }
        } catch {
            Write-Host "[!] Erro no loop de impressao: $_" -ForegroundColor Red
        }
    }
}
