# =====================================================================
#    SALGADOS VIP - SERVIDOR DE IMPRESSÃO SILENCIOSA LOCAL (WINDOWS)
# =====================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$port = 18181
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")

try {
    $listener.Start()
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host " [OK] SERVIDOR DE IMPRESSAO SILENCIOSA LOCAL INICIADO" -ForegroundColor Green
    Write-Host " Porta: $port (http://127.0.0.1:$port/)" -ForegroundColor Cyan
    Write-Host " Modo: Direto no Spooler do Windows (Zero Janelas / Sem Dialogos)" -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Green
} catch {
    Write-Host "Erro ao iniciar listener na porta $port: $_" -ForegroundColor Red
    exit 1
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        if ($request.HttpMethod -eq "POST" -and $request.Url.LocalPath -eq "/print") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $reader.Close()

            $json = ConvertFrom-Json $body
            $receiptText = $json.receiptText
            $orderId = $json.orderId
            $printerName = $json.printerName
            $copies = if ($json.copies) { [int]$json.copies } else { 1 }

            Write-Host "[*] Recebido pedido $orderId para impressao ($copies via(s))..." -ForegroundColor Cyan

            # Salva temporariamente em arquivo texto UTF-8 para o spooler imprimir sem perder acentuação
            $tempFile = [System.IO.Path]::GetTempFileName() + ".txt"
            [System.IO.File]::WriteAllText($tempFile, $receiptText, [System.Text.Encoding]::GetEncoding(1252))

            for ($i = 1; $i -le $copies; $i++) {
                if ($printerName -and $printerName -ne "windows_default") {
                    Get-Content $tempFile | Out-Printer -Name $printerName
                } else {
                    Get-Content $tempFile | Out-Printer
                }
            }

            if (Test-Path $tempFile) {
                Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            }

            Write-Host "[+] Pedido $orderId impresso diretamente na impressora padrao!" -ForegroundColor Green

            $respObj = @{
                success = $true
                orderId = $orderId
                message = "Impresso com sucesso via Spooler do Windows."
            } | ConvertTo-Json

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
