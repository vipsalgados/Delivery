param(
    [string]$RepoUrl = "",
    [string]$CommitMessage = "chore: update project files",
    [string]$Branch = "main",
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   GITHUB SKILL - PUBLICADOR E SINCRONIZADOR GIT" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Verify Git installation
try {
    $gitVer = git --version
    Write-Host "[OK] $gitVer" -ForegroundColor Green
} catch {
    Write-Error "Git não está instalado ou não está no PATH."
    exit 1
}

# 2. Initialize Git repo if needed
if (-not (Test-Path ".git")) {
    Write-Host "[INFO] Inicializando repositório Git..." -ForegroundColor Yellow
    git init
    git branch -M $Branch
}

# 3. Ensure Git user.name and user.email exist (fallback local config if global is unset)
$userName = git config user.name
$userEmail = git config user.email
if (-not $userName) {
    git config user.name "Developer"
    Write-Host "[INFO] user.name local definido como 'Developer'" -ForegroundColor Yellow
}
if (-not $userEmail) {
    git config user.email "developer@users.noreply.github.com"
    Write-Host "[INFO] user.email local definido como 'developer@users.noreply.github.com'" -ForegroundColor Yellow
}

# 4. Stage and commit changes
git add -A
$status = git status --porcelain
if ($status) {
    git commit -m $CommitMessage
    Write-Host "[OK] Commit realizado: $CommitMessage" -ForegroundColor Green
} else {
    Write-Host "[OK] Nenhuma alteração pendente para commit." -ForegroundColor Gray
}

# 5. Configure remote origin if provided
if ($RepoUrl -and $RepoUrl.Trim()) {
    $existingRemotes = git remote
    if ($existingRemotes -contains "origin") {
        git remote set-url origin $RepoUrl.Trim()
        Write-Host "[OK] Remote 'origin' atualizado para: $RepoUrl" -ForegroundColor Green
    } else {
        git remote add origin $RepoUrl.Trim()
        Write-Host "[OK] Remote 'origin' adicionado: $RepoUrl" -ForegroundColor Green
    }
}

# 6. Push if remote origin exists and -NoPush is not set
$remotes = git remote
if (-not $NoPush -and ($remotes -contains "origin")) {
    Write-Host "[INFO] Enviando alterações para origin/$Branch..." -ForegroundColor Cyan
    git push -u origin $Branch
    Write-Host "[OK] Push concluído com sucesso!" -ForegroundColor Green
} elseif (-not ($remotes -contains "origin")) {
    Write-Host "[AVISO] Nenhum remote 'origin' configurado. Use -RepoUrl 'https://github.com/usuario/repo.git' para publicar." -ForegroundColor Yellow
}
