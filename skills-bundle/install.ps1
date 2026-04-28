# ============================================================
#   ObservAI Skills Bundle - PowerShell Installer
#   ----------------------------------------------------------
#   Vercel skills CLI + RuFlo multi-agent orchestration
#   Hedef dizin: $env:USERPROFILE\.claude\skills\
#   Bu kullanici-seviyesinde, hesap degisirse bile kalir.
# ============================================================

param(
    [ValidateSet('all', 'skills', 'ruflo', 'verify')]
    [string]$Mode = 'all'
)

$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.ForegroundColor = 'White'

function Write-Header($text) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Install-Skill($Repo, $Skill) {
    Write-Host "[INSTALL] $Repo --skill $Skill (global, claude-code)" -ForegroundColor Yellow
    $null = & npx -y skills add $Repo --skill $Skill -g -a claude-code -y --copy 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK]   $Skill" -ForegroundColor Green
    } else {
        Write-Host "  [SKIP] $Skill - zaten var olabilir veya repo'da yok." -ForegroundColor Gray
    }
}

Write-Header "ObservAI Skills Bundle Installer"

# Node.js kontrolu
try {
    $nodeVer = & node --version 2>&1
    Write-Host "[OK] Node.js $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "[HATA] Node.js bulunamadi. https://nodejs.org/ adresinden kur." -ForegroundColor Red
    exit 1
}

# Skill dizini
$ClaudeDir = Join-Path $env:USERPROFILE '.claude'
$SkillsDir = Join-Path $ClaudeDir 'skills'
New-Item -ItemType Directory -Force -Path $SkillsDir | Out-Null
Write-Host "[OK] Skill dizini: $SkillsDir" -ForegroundColor Green

if ($Mode -eq 'verify') {
    Write-Header "Kurulu Skiller"
    & npx -y skills list -g
    Write-Host ""
    Write-Host "Dizin: $SkillsDir"
    if (Get-Command ruflo -ErrorAction SilentlyContinue) {
        Write-Host "[OK] ruflo CLI global olarak kurulu" -ForegroundColor Green
    } else {
        Write-Host "[INFO] ruflo CLI global degil - npx ruflo@latest ile calisir" -ForegroundColor Gray
    }
    exit 0
}

if ($Mode -in @('all', 'skills')) {
    Write-Header "1) Anthropic resmi skiller (anthropics/skills)"
    $anthropicSkills = @(
        'webapp-testing',         # Playwright web testing - frontend testleri icin
        'frontend-design',        # React/UI design rehberi
        'claude-api',             # Claude/Anthropic SDK best practices (Ollama disinda)
        'mcp-builder',            # ObservAI Python analytics -> MCP server
        'skill-creator',          # ObservAI'ya ozel skill olustur
        'web-artifacts-builder'   # Cowork'te canli artifact olustur
    )
    foreach ($s in $anthropicSkills) { Install-Skill 'anthropics/skills' $s }

    Write-Header "2) obra/superpowers (test + plan + multi-agent)"
    $superpowers = @(
        'test-driven-development',
        'systematic-debugging',
        'subagent-driven-development',
        'dispatching-parallel-agents',
        'writing-plans',
        'executing-plans',
        'verification-before-completion',
        'using-git-worktrees',
        'requesting-code-review',
        'brainstorming'
    )
    foreach ($s in $superpowers) { Install-Skill 'obra/superpowers' $s }

    Write-Header "3) ComposioHQ awesome-claude-skills"
    $composio = @(
        'changelog-generator',         # Release notes (ROADMAP adimlari icin)
        'file-organizer',              # Repo temizligi
        'meeting-insights-analyzer',
        'developer-growth-analysis',   # Ekip code metric analizi
        'artifacts-builder',
        'content-research-writer'
    )
    foreach ($s in $composio) { Install-Skill 'ComposioHQ/awesome-claude-skills' $s }
}

if ($Mode -in @('all', 'ruflo')) {
    Write-Header "4) RuFlo - Multi-Agent Orchestration Platform"
    Write-Host "[INSTALL] npm install -g ruflo@latest" -ForegroundColor Yellow
    & npm install -g ruflo@latest
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[UYARI] Global ruflo kurulumu basarisiz - npx ruflo@latest fallback olarak calisir" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "RuFlo init wizard'i icin (ObservAI klasorunde):" -ForegroundColor Cyan
    Write-Host "  cd C:\Users\Gaming\Desktop\Project\ObservAI" -ForegroundColor White
    Write-Host "  npx ruflo@latest init --wizard" -ForegroundColor White
}

Write-Header "Kurulum Tamamlandi"
Write-Host "Sonraki adimlar:"
Write-Host "  1) Claude Code / Cowork yeniden baslat"
Write-Host "  2) npx skills list -g  (kurulan skilleri gor)"
Write-Host "  3) USAGE_GUIDE.md  (ObservAI kullanim ornekleri)"
Write-Host ""
