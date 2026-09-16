# Veröffentlicht den aktuellen Stand ins öffentliche Repo „meine-tools“ (GitHub Pages).
# Übernommen wird nur, was in Git eingecheckt ist: persönliche *.lokal.js-Dateien und der
# Verlauf dieses privaten Repos bleiben draußen.
#
#   powershell -ExecutionPolicy Bypass -File veroeffentlichen.ps1              # Stand von main
#   powershell -ExecutionPolicy Bypass -File veroeffentlichen.ps1 -Ref feature/x
#   powershell -ExecutionPolicy Bypass -File veroeffentlichen.ps1 -NurAnzeigen # nichts hochladen
param(
  [string]$Ref = "main",
  [switch]$NurAnzeigen
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ziel = "https://github.com/manuelulreich1-star/meine-tools.git"
# Anonyme GitHub-Adresse, damit keine private E-Mail in öffentlichen Commits steht.
$autorName = "manuelulreich1-star"
$autorMail = "330053187+manuelulreich1-star@users.noreply.github.com"

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("meine-tools-" + [guid]::NewGuid().ToString("N"))
git clone --quiet $ziel $tmp
if ($LASTEXITCODE -ne 0) { throw "Öffentliches Repo konnte nicht geladen werden." }

try {
  # Alten Inhalt entfernen (außer .git) und den eingecheckten Stand exportieren.
  Get-ChildItem $tmp -Force | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force
  $zip = Join-Path ([IO.Path]::GetTempPath()) ("export-" + [guid]::NewGuid().ToString("N") + ".zip")
  git -C $root archive --format=zip -o $zip $Ref
  if ($LASTEXITCODE -ne 0) { throw "Stand '$Ref' konnte nicht exportiert werden." }
  Expand-Archive -Path $zip -DestinationPath $tmp
  Remove-Item $zip -Force

  # Nur für die lokale Entwicklung gedacht.
  Remove-Item (Join-Path $tmp ".claude") -Recurse -Force -ErrorAction SilentlyContinue

  # Sicherheitsprüfung: Zugangsdaten, private Kontaktdaten und Begriffe aus der lokalen
  # Sperrliste dürfen nie öffentlich werden. Bei einem Treffer wird abgebrochen.
  $muster = @(
    @{ Name = "E-Mail-Adresse";         Regex = '[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com)[A-Za-z0-9.-]+\.[A-Za-z]{2,}' },
    @{ Name = "Google-Clientschlüssel"; Regex = 'GOCSPX-|client_secret' },
    @{ Name = "Google-API-Schlüssel";   Regex = 'AIza[0-9A-Za-z_-]{35}' },
    @{ Name = "GitHub-Token";           Regex = 'gh[pousr]_[A-Za-z0-9]{30,}|github_pat_' },
    @{ Name = "Privater Schlüssel";     Regex = '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
    @{ Name = "Passwort im Code";       Regex = '(?i)(passwor[dt]|pwd)\s*[:=]\s*["''][^"'']+["'']' },
    @{ Name = "IBAN";                   Regex = '\b[A-Z]{2}\d{2}(\s?\d{4}){4}\s?\d{1,4}\b' },
    @{ Name = "Telefonnummer";          Regex = '\+49[\s/-]?\d{2,}' }
  )
  $sperrliste = Join-Path $root "veroeffentlichen.sperrliste.lokal.txt"
  if (Test-Path $sperrliste) {
    Get-Content $sperrliste -Encoding UTF8 | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith("#") } | ForEach-Object {
      $muster += @{ Name = "Sperrliste: $($_.Trim())"; Regex = '(?i)\b' + [regex]::Escape($_.Trim()) + '\b' }
    }
  } else {
    Write-Warning "Keine Sperrliste gefunden ($sperrliste) – es werden nur die Standardmuster geprüft."
  }
  $treffer = @()
  # Dieses Skript selbst enthält die Muster als Text und wird deshalb nicht durchsucht.
  $dateien = Get-ChildItem $tmp -Recurse -File -Force |
    Where-Object { $_.FullName -notlike "*\.git\*" -and $_.Name -ne "veroeffentlichen.ps1" }
  foreach ($m in $muster) {
    $dateien | Select-String -Pattern $m.Regex -CaseSensitive:$false | ForEach-Object {
      $treffer += "  [$($m.Name)] $($_.Path.Substring($tmp.Length + 1)):$($_.LineNumber)"
    }
  }
  if ($treffer.Count) {
    Write-Host "ABGEBROCHEN – möglicherweise sensible Inhalte gefunden:" -ForegroundColor Red
    $treffer | Sort-Object -Unique | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    Write-Host "Bitte entfernen (persönliches gehört in *.lokal.*-Dateien) oder die Sperrliste anpassen."
    exit 1
  }

  # Leere Platzhalter statt der persönlichen Vorlagen (vermeidet 404-Meldungen).
  $platzhalter = "// Platzhalter: persönliche Vorlagen gibt es nur in der lokalen Version.`n"
  foreach ($datei in @("kalender\vorlagen.lokal.js", "todo\vorlagen.lokal.js")) {
    [IO.File]::WriteAllText((Join-Path $tmp $datei), $platzhalter)
  }
  # GitHub Pages ohne Jekyll-Verarbeitung ausliefern.
  [IO.File]::WriteAllText((Join-Path $tmp ".nojekyll"), "")

  git -C $tmp add -A -f
  $aenderungen = git -C $tmp status --short
  if (-not $aenderungen) {
    Write-Host "Keine Änderungen – die Online-Version ist bereits aktuell."
    return
  }

  Write-Host "Folgende Dateien werden veröffentlicht:"
  git -C $tmp ls-files | ForEach-Object { Write-Host "  $_" }
  Write-Host ""
  Write-Host "Änderungen gegenüber der Online-Version:"
  $aenderungen | ForEach-Object { Write-Host "  $_" }

  if ($NurAnzeigen) {
    Write-Host ""
    Write-Host "Nur angezeigt, nichts hochgeladen."
    return
  }

  $stand = git -C $root rev-parse --short $Ref
  git -C $tmp -c user.name=$autorName -c user.email=$autorMail commit --quiet -m "Stand $stand"
  git -C $tmp push --quiet origin HEAD:main
  if ($LASTEXITCODE -ne 0) { throw "Hochladen fehlgeschlagen." }
  Write-Host ""
  Write-Host "Veröffentlicht: https://manuelulreich1-star.github.io/meine-tools/"
}
finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
