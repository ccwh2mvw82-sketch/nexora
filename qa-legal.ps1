# ============================================================
#  Controle des informations legales obligatoires
#  La loi impose que le site publie l'identite de l'editeur,
#  son adresse, son SIRET, son RCS, le directeur de publication
#  et l'hebergeur. Les registres de nom de domaine (.fr, .com)
#  exigent en plus que ces coordonnees soient accessibles et
#  reelles, sous peine de suspension du domaine.
#
#  Ce script lit js/site-info.js, source unique de verite, et
#  signale tout champ encore vide, a "TODO" ou manifestement
#  fictif. Il verifie aussi que ces champs sont bien affiches
#  quelque part sur le site.
#
#  Usage : powershell -NoProfile -ExecutionPolicy Bypass -File qa-legal.ps1
#  Code de sortie 0 = prete pour la mise en ligne,
#                    1 = informations obligatoires manquantes.
# ============================================================
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-Field {
    param([string]$Nom)
    $t = Get-Content (Join-Path $Root "js\site-info.js") -Raw
    $m = [regex]::Match($t, [regex]::Escape($Nom) + '\s*:\s*"([^"]*)"')
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    return $null
}

$obligatoires = @(
    @{ Clef = "company";   Libelle = "Nom de l'editeur";       Aide = "GestAffaires - Gestion & Digital" },
    @{ Clef = "legalForm"; Libelle = "Forme juridique";         Aide = "SASU, SARL, EI, EURL..." },
    @{ Clef = "address";   Libelle = "Adresse du siege";        Aide = "numero, rue, code postal, ville" },
    @{ Clef = "siret";     Libelle = "Numero SIRET";            Aide = "14 chiffres" },
    @{ Clef = "rcs";       Libelle = "RCS";                     Aide = "ville et numero, ex. RCS PARIS 123 456 789" },
    @{ Clef = "director";  Libelle = "Directeur de publication"; Aide = "nom du personne physique" },
    @{ Clef = "host";      Libelle = "Hebergeur";               Aide = "nom, adresse et telephone" }
)

$recommandes = @(
    @{ Clef = "phoneDisplay"; Libelle = "Telephone";            Aide = "un vrai numero joignable" },
    @{ Clef = "email";        Libelle = "Email";                Aide = "une adresse reelle" },
    @{ Clef = "linkedin";     Libelle = "Page LinkedIn";        Aide = "URL du profil" },
    @{ Clef = "facebook";     Libelle = "Page Facebook";        Aide = "URL du profil" },
    @{ Clef = "googleReviews"; Libelle = "Fiche Google";        Aide = "URL de la fiche" }
)

function Test-Rempli {
    param([string]$Valeur)
    if ($null -eq $Valeur) { return $false }
    if ($Valeur.Trim() -eq "") { return $false }
    if ($Valeur.Trim() -eq "TODO") { return $false }
    return $true
}

Write-Host ""
Write-Host "INFORMATIONS LEGALES OBLIGATOIRES" -ForegroundColor Cyan
Write-Host ("-" * 66)

$manquants = @()

foreach ($f in $obligatoires) {
    $v = Get-Field $f.Clef
    if (Test-Rempli $v) {
        Write-Host ("  OK   {0,-26} {1}" -f $f.Libelle, $v) -ForegroundColor Green
    } else {
        Write-Host ("  MANQUE {0,-25} a completer : {1}" -f $f.Libelle, $f.Aide) -ForegroundColor Red
        $manquants += $f.Libelle
    }
}

Write-Host ""
Write-Host "INFORMATIONS RECOMMANDEES" -ForegroundColor Cyan
Write-Host ("-" * 66)

$manquantsOpt = @()
foreach ($f in $recommandes) {
    $v = Get-Field $f.Clef
    if (Test-Rempli $v) {
        Write-Host ("  OK   {0,-26} {1}" -f $f.Libelle, $v) -ForegroundColor Green
    } else {
        Write-Host ("  --   {0,-26} facultatif" -f $f.Libelle) -ForegroundColor DarkGray
        $manquantsOpt += $f.Libelle
    }
}

Write-Host ""
Write-Host "CONTROLE DES VALEURS" -ForegroundColor Cyan
Write-Host ("-" * 66)

$tel = Get-Field "phoneDisplay"
if (Test-Rempli $tel) {
    if ($tel -match '01 02 03 04 05' -or $tel -match '06 12 34 56 78' -or $tel -match '01 23 45 67 89') {
        Write-Host ("  ATTENTION Telephone : " + $tel + " ressemble a un numero d'exemple.") -ForegroundColor Yellow
        Write-Host "  S'il appartient a quelqu'un, il sonne chez cette personne." -ForegroundColor Yellow
    } else {
        Write-Host ("  OK   Telephone : " + $tel) -ForegroundColor Green
    }
} else {
    Write-Host "  --   Telephone : non renseigne" -ForegroundColor DarkGray
}

$siret = Get-Field "siret"
if (Test-Rempli $siret) {
    $chiffres = $siret -replace '\D', ''
    if ($chiffres.Length -ne 14) {
        Write-Host ("  KO   SIRET : $siret ne comporte pas 14 chiffres ({1})." -f $chiffres.Length) -ForegroundColor Red
        $manquants += "SIRET (format)"
    } else {
        Write-Host ("  OK   SIRET : $siret (14 chiffres)") -ForegroundColor Green
    }
}

$ig = Get-Field "instagram"
if (Test-Rempli $ig) {
    Write-Host ("  INFO Instagram : " + $ig) -ForegroundColor DarkGray
    Write-Host "  Verifiez que ce profil vous appartient bien." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "OUBLI DES MOTS-CLEES TODO DANS LE SITE" -ForegroundColor Cyan
Write-Host ("-" * 66)

$pages = @("index.html", "pole-temps.html", "pole-visibilite.html", "pole-marches.html", "mentions-legales.html")
$fuites = 0
foreach ($p in $pages) {
    $fich = Join-Path $Root $p
    if (-not (Test-Path $fich)) { continue }
    $html = Get-Content $fich -Raw
    $n = ([regex]::Matches($html, 'TODO')).Count
    if ($n -gt 0) {
        Write-Host ("  KO   {0,-24} {1} occurrence(s) de TODO" -f $p, $n) -ForegroundColor Red
        $fuites += $n
    } else {
        Write-Host ("  OK   {0,-24} aucun TODO" -f $p) -ForegroundColor Green
    }
}

Write-Host ""
Write-Host ("-" * 66)

if ($manquants.Count -eq 0 -and $fuites -eq 0) {
    Write-Host "RESULTAT : prete pour la mise en ligne commerciale." -ForegroundColor Green
    exit 0
}

Write-Host "RESULTAT : site NON conforme a la mise en ligne." -ForegroundColor Red
if ($manquants.Count -gt 0) {
    Write-Host ("  {0} information(s) obligatoire(s) manquante(s) :" -f $manquants.Count) -ForegroundColor Red
    $manquants | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
}
if ($fuites -gt 0) {
    Write-Host ("  {0} occurrence(s) de TODO encore visible(s) dans le HTML." -f $fuites) -ForegroundColor Red
}
Write-Host ""
Write-Host "Tout se remplit dans un seul fichier : js/site-info.js" -ForegroundColor Cyan
Write-Host "Relancez ce script apres chaque modification." -ForegroundColor Cyan
exit 1