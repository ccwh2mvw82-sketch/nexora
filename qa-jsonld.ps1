# ============================================================
#  Controle de coherence des donnees structurees (JSON-LD)
#  Le JSON-LD n'est pas genere par JavaScript : les moteurs de
#  recherche le lisent tel quel. Ce script verifie donc que le
#  telephone et l'email du JSON-LD correspondent exactement a
#  js/site-info.js, source de verite du reste du site.
#
#  Usage : powershell -NoProfile -ExecutionPolicy Bypass -File qa-jsonld.ps1
#  Code de sortie 0 = OK, 1 = divergence a corriger.
# ============================================================
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

$info = Get-Content (Join-Path $Root "js\site-info.js") -Raw
if ($info -match 'phoneDigits:\s*"([^"]+)"') { $phoneDigits = $Matches[1] } else { Write-Host "ERREUR : phoneDigits introuvable dans js/site-info.js"; exit 1 }
if ($info -match 'email:\s*"([^"]+)"') { $email = $Matches[1] } else { Write-Host "ERREUR : email introuvable dans js/site-info.js"; exit 1 }

$expectedTel = "+" + $phoneDigits
$pages = @("index.html", "pole-temps.html", "pole-visibilite.html", "pole-marches.html")
$ko = 0

foreach ($p in $pages) {
  $file = Join-Path $Root $p
  $html = Get-Content $file -Raw
  $blocks = [regex]::Matches($html, '(?s)<script type="application/ld\+json">(.*?)</script>')
  if (-not $blocks.Count) { Write-Host "  $p : aucun JSON-LD"; continue }

  $raw = $blocks[0].Groups[1].Value
  # le telephone n'apparait que dans certaines pages
  $m = [regex]::Match($raw, '"telephone"\s*:\s*"([^"]+)"')
  if ($m.Success) {
    if ($m.Groups[1].Value -eq $expectedTel) {
      Write-Host "  OK  $p : telephone = $($m.Groups[1].Value)"
    } else {
      Write-Host "  KO  $p : telephone JSON-LD = $($m.Groups[1].Value), attendu $expectedTel"
      $ko++
    }
  } else {
    Write-Host "  --  $p : pas de telephone en JSON-LD"
  }

  $e = [regex]::Match($raw, '"email"\s*:\s*"([^"]+)"')
  if ($e.Success) {
    if ($e.Groups[1].Value -eq $email) {
      Write-Host "  OK  $p : email = $($e.Groups[1].Value)"
    } else {
      Write-Host "  KO  $p : email JSON-LD = $($e.Groups[1].Value), attendu $email"
      $ko++
    }
  }

  # le JSON doit rester valide
  try { $null = $raw | ConvertFrom-Json } catch {
    Write-Host "  KO  $p : JSON-LD invalide -> $($_.Exception.Message)"
    $ko++
  }
}

if ($ko -gt 0) { Write-Host ""; Write-Host "RESULTAT : $ko divergence(s) a corriger."; exit 1 }
Write-Host ""
Write-Host "RESULTAT : JSON-LD coherent avec js/site-info.js."
exit 0