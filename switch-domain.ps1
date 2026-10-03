param(
    [Parameter(Mandatory = $true)]
    [string]$Domain,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$OLD = "https://ccwh2mvw82-sketch.github.io/nexora"

$Domain = $Domain.Trim().TrimEnd("/")
if ($Domain -match "^https?://") {
    $Domain = $Domain -replace "^https?://", ""
}
$Domain = $Domain.TrimEnd("/")

if ($Domain -notmatch "^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$") {
    Write-Host "Domaine refuse : '$Domain'" -ForegroundColor Red
    Write-Host "Attendu : gestaffaires.fr  ou  www.gestaffaires.fr"
    exit 1
}

$NEW = "https://$Domain"

$targets = @(
    "index.html",
    "pole-temps.html",
    "pole-visibilite.html",
    "pole-marches.html",
    "404.html",
    "robots.txt",
    "sitemap.xml"
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$missing = @()
foreach ($f in $targets) {
    if (-not (Test-Path (Join-Path $root $f))) { $missing += $f }
}
if ($missing.Count -gt 0) {
    Write-Host ("Fichier(s) introuvable(s) : " + ($missing -join ", ")) -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Ancienne URL : $OLD" -ForegroundColor DarkGray
Write-Host "Nouvelle URL : $NEW" -ForegroundColor Cyan
if ($DryRun) { Write-Host "MODE SIMULATION : aucune ecriture" -ForegroundColor Yellow }
Write-Host ("-" * 62)

$enc = [System.Text.UTF8Encoding]::new($false)
$total = 0

foreach ($f in $targets) {
    $p = Join-Path $root $f
    $text = [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8)
    $count = ([regex]::Matches($text, [regex]::Escape($OLD))).Count
    if ($count -eq 0) {
        Write-Host ("  {0,-22} deja a jour" -f $f) -ForegroundColor DarkGray
        continue
    }
    $total += $count
    Write-Host ("  {0,-22} {1,3} remplacement(s)" -f $f, $count) -ForegroundColor Green
    if (-not $DryRun) {
        [IO.File]::WriteAllText($p, $text.Replace($OLD, $NEW), $enc)
    }
}

Write-Host ("-" * 62)
Write-Host ("Total : $total occurrence(s)")

if ($DryRun) {
    Write-Host "Relancez sans -DryRun pour appliquer." -ForegroundColor Yellow
    exit 0
}

$restant = 0
foreach ($f in $targets) {
    $t = [IO.File]::ReadAllText((Join-Path $root $f), [Text.Encoding]::UTF8)
    $restant += ([regex]::Matches($t, [regex]::Escape($OLD))).Count
}

if ($restant -gt 0) {
    Write-Host ""
    Write-Host "ATTENTION : $restant occurrence(s) de l'ancienne URL subsistent." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Verification : plus aucune reference a github.io." -ForegroundColor Green

$canon = [regex]::Match([IO.File]::ReadAllText((Join-Path $root "index.html"), [Text.Encoding]::UTF8), '<link rel="canonical" href="([^"]+)"').Groups[1].Value
Write-Host "Canonical index : $canon"

if ($Domain.StartsWith("www.")) {
    Write-Host ""
    Write-Host "Vous avez choisi la version www. Redirigez la version sans www" -ForegroundColor Yellow
    Write-Host "vers celle-ci, une seule fois, cote DNS ou hebergeur." -ForegroundColor Yellow
    Write-Host "Deux versions en parallele, c'est deux pages dupliquees pour Google." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Il reste a refaire manuellement : les liens de partage sociaux" -ForegroundColor Cyan
Write-Host "(Facebook, X, LinkedIn, WhatsApp) qui gardent en cache l'URL" -ForegroundColor Cyan
Write-Host "et l'ancienne image, et a recreer avec vos vraies coordonnees." -ForegroundColor Cyan
Write-Host ""
Write-Host " ensuite : git add -A ; git commit -m ""changement de domaine"" ; git push" -ForegroundColor DarkGray