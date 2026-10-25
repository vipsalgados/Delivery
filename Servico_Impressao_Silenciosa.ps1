# =====================================================================
#    SALGADOS VIP - SERVIDOR DE IMPRESSÃO SILENCIOSA LOCAL (WINDOWS)
#    VERSÃO HARDENED / BLINDADA (AUDITORIA DE SEGURANÇA 2026)
# =====================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$port = 18181
$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDataDir = Join-Path $env:LOCALAPPDATA "SalgadosVIP"
if (-not (Test-Path $appDataDir)) {
    New-Item -ItemType Directory -Path $appDataDir -Force | Out-Null
}

$tokenFile = Join-Path $appDataDir "service_auth.key"
$localTokenFile = Join-Path $baseDir "whatsapp_service_token.json"

# Obtenção ou geração do Token Local
$authToken = ""
if (Test-Path $tokenFile) {
    try {
        $t = (Get-Content $tokenFile -Raw).Trim()
        if ($t.Length -ge 32) { $authToken = $t }
    } catch {}
}
if (-not $authToken -and (Test-Path $localTokenFile)) {
    try {
        $json = Get-Content $localTokenFile -Raw | ConvertFrom-Json
        if ($json.token) { $authToken = $json.token }
    } catch {}
}
if (-not $authToken) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $authToken = ($bytes | ForEach-Object { "{0:x2}" -f $_ }) -join ""
    try {
        Set-Content -Path $tokenFile -Value $authToken -Encoding UTF8
    } catch {}
}

function Test-IsOriginAllowed($origin) {
    if ([string]::IsNullOrWhiteSpace($origin)) { return $true }
    $olow = $origin.ToLower().Trim()
    if ($olow -eq "null") { return $true }
    if ($olow -match "^https?://(127\.0\.0\.1|localhost)(:\d+)?$") { return $true }
    if ($olow -match "^https://[a-zA-Z0-9-]+\.github\.io$") { return $true }
    return $false
}

function Test-IsAuthenticated($request) {
    $token = $request.Headers["X-VIP-Token"]
    if (-not $token) {
        $authH = $request.Headers["Authorization"]
        if ($authH -and $authH.StartsWith("Bearer ")) {
            $token = $authH.Substring(7).Trim()
        }
    }
    if (-not $token -and $request.QueryString["token"]) {
        $token = $request.QueryString["token"]
    }
    if (-not $token) { return $false }
    return ($token -eq $authToken)
}

function Set-CorsHeaders($response, $origin) {
    if ($origin) {
        $response.AddHeader("Access-Control-Allow-Origin", $origin)
    }
    $response.AddHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, X-VIP-Token, Authorization")
    $response.AddHeader("Vary", "Origin")
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")

try {
    $listener.Start()
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host " [OK] SERVIDOR DE IMPRESSAO SILENCIOSA LOCAL BLINDADO INICIADO" -ForegroundColor Green
    Write-Host " Porta: $port (http://127.0.0.1:$port/)" -ForegroundColor Cyan
    Write-Host " Modo: Direto no Spooler do Windows (Zero Janelas / Sem Dialogos)" -ForegroundColor Yellow
    Write-Host " Seguranca: Token Ativo + CORS Estrito + Bloqueio Injection" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
} catch {
    Write-Host "Erro ao iniciar listener na porta ${port}: $_" -ForegroundColor Red
    exit 1
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $origin = $request.Headers["Origin"]
        if (-not (Test-IsOriginAllowed $origin)) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        Set-CorsHeaders $response $origin

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        if ($request.HttpMethod -eq "GET" -and $request.Url.LocalPath -eq "/ping") {
            $respObj = @{ online = $true; service = "Salgados VIP Spooler PS" } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($respObj)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()
            continue
        }

        # Verificação de Autenticação Estrita
        if (-not (Test-IsAuthenticated $request)) {
            $response.StatusCode = 401
            $respObj = @{ success = $false; error = "Unauthorized: Token ausente ou invalido." } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($respObj)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()
            continue
        }

        if ($request.HttpMethod -eq "POST" -and $request.Url.LocalPath -eq "/print") {
            # Validação do limite de tamanho do payload (máx 64KB)
            if ($request.ContentLength64 -gt 65536) {
                $response.StatusCode = 400
                $respObj = @{ success = $false; error = "Payload excede o limite de seguranca de 64KB." } | ConvertTo-Json
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.OutputStream.Close()
                continue
            }

            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $reader.Close()

            $json = ConvertFrom-Json $body
            $receiptText = if ($json.receiptText) { $json.receiptText } else { $json.text }
            $orderId = if ($json.orderId) { $json.orderId } else { "MANUAL" }
            $printerName = $json.printerName

            # Sanitização estrita do nome da impressora contra injeção de comandos
            if ($printerName -and ($printerName -match "[;&|`$<>]")) {
                $response.StatusCode = 400
                $respObj = @{ success = $false; error = "Nome de impressora invalido ou inseguro." } | ConvertTo-Json
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.OutputStream.Close()
                continue
            }

            # Limite estrito de vias (1 a 5)
            $copies = 1
            if ($json.copies) {
                $rawCopies = [int]$json.copies
                if ($rawCopies -lt 1) { $copies = 1 }
                elseif ($rawCopies -gt 5) { $copies = 5 }
                else { $copies = $rawCopies }
            }

            Write-Host "[*] Recebido pedido $orderId para impressao ($copies via(s))..." -ForegroundColor Cyan

            $tempFile = [System.IO.Path]::GetTempFileName() + ".txt"
            $printSuccess = $false
            $printError = ""

            try {
                [System.IO.File]::WriteAllText($tempFile, $receiptText, [System.Text.Encoding]::GetEncoding(1252))

                for ($i = 1; $i -le $copies; $i++) {
                    if ($printerName -and $printerName -ne "windows_default") {
                        Get-Content -LiteralPath $tempFile | Out-Printer -Name $printerName
                    } else {
                        Get-Content -LiteralPath $tempFile | Out-Printer
                    }
                }
                $printSuccess = $true
            } catch {
                $printError = $_.Exception.Message
                Write-Host "[!] Erro ao imprimir: $printError" -ForegroundColor Red
            } finally {
                # Limpeza garantida do arquivo temporário mesmo em caso de exceção
                if ($tempFile -and (Test-Path $tempFile)) {
                    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
                }
            }

            if ($printSuccess) {
                Write-Host "[+] Pedido $orderId impresso diretamente na impressora padrao!" -ForegroundColor Green
                $respObj = @{
                    success = $true
                    orderId = $orderId
                    message = "Impresso com sucesso via Spooler do Windows."
                } | ConvertTo-Json
            } else {
                $respObj = @{
                    success = $false
                    orderId = $orderId
                    error = "Falha ao imprimir: $printError"
                } | ConvertTo-Json
            }

            $buffer = [System.Text.Encoding]::UTF8.GetBytes($respObj)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()
        } elseif ($request.Url.LocalPath -eq "/status") {
            $defaultPrinter = (Get-CimInstance Win32_Printer | Where-Object Default -eq $true | Select-Object -ExpandProperty Name)
            $respObj = @{
                status = "online"
                defaultPrinter = $defaultPrinter
            } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($respObj)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()
        } else {
            $response.StatusCode = 404
            $response.Close()
        }
    } catch {
        Write-Host "Erro: $_" -ForegroundColor Red
    }
}
