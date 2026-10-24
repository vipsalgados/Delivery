$ErrorActionPreference = "Stop"
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   PREPARADOR E PUBLICADOR PARA GITHUB - SALGADOS VIP" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica se o git está instalado
try {
    $gitVer = git --version
    Write-Host "[OK] Git detectado no computador: $gitVer" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] O Git não está instalado ou não foi encontrado no PATH do Windows." -ForegroundColor Red
    Write-Host "Baixe e instale o Git gratuitamente em: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# 2. Inicializa o repositório git se necessário
if (-not (Test-Path ".git")) {
    Write-Host "[INFO] Inicializando repositório Git local..." -ForegroundColor Yellow
    git init
    git branch -M main
}

# 3. Adiciona arquivos e realiza commit
Write-Host "[INFO] Adicionando arquivos do projeto ao Git..." -ForegroundColor Cyan
git add .
$status = git status --porcelain
if ($status) {
    git commit -m "Deploy Salgados VIP Delivery & PWA"
    Write-Host "[OK] Commit realizado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "[OK] Nenhum arquivo alterado pendente para commit." -ForegroundColor Gray
}

# 4. Configuração do repositório remoto
$remotes = git remote
if (-not $remotes) {
    Write-Host ""
    Write-Host "Digite ou cole a URL do seu repositório criado no GitHub" -ForegroundColor Yellow
    Write-Host "(Exemplo: https://github.com/SEU_USUARIO/salgados-vip.git):" -ForegroundColor Gray
    $repoUrl = Read-Host "URL do Repositório GitHub"
    if ($repoUrl -and $repoUrl.Trim()) {
        git remote add origin $repoUrl.Trim()
        Write-Host "[OK] Repositório remoto 'origin' configurado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "[AVISO] Nenhuma URL informada. Você pode executar 'git push' manualmente mais tarde." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "Deseja enviar agora para o GitHub (git push -u origin main)? [S/N]" -ForegroundColor Yellow
$resp = Read-Host "Opção"
if ($resp -match "^[sSyY]") {
    try {
        git push -u origin main
        Write-Host ""
        Write-Host "=======================================================" -ForegroundColor Green
        Write-Host "✓ CÓDIGO ENVIADO COM SUCESSO PARA O GITHUB!" -ForegroundColor Green
        Write-Host "=======================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Para ativar o site no ar pelo GitHub Pages:" -ForegroundColor Cyan
        Write-Host "1. Abra seu repositório no navegador (github.com)." -ForegroundColor White
        Write-Host "2. Vá em 'Settings' -> aba lateral 'Pages'." -ForegroundColor White
        Write-Host "3. Em 'Branch', selecione 'main' e pasta '/ (root)'." -ForegroundColor White
        Write-Host "4. Clique em 'Save'. Em 1 minuto seu app estará no ar!" -ForegroundColor White
    } catch {
        Write-Host "[ERRO] Erro ao enviar para o GitHub: $_" -ForegroundColor Red
        Write-Host "Dica: certifique-se de que você está logado no Git com suas credenciais do GitHub." -ForegroundColor Yellow
    }
}
