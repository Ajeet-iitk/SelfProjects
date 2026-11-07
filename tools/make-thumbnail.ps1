# Captures a 1280x800 thumbnail with headless Chrome or Edge.
#
#   powershell -ExecutionPolicy Bypass -File tools/make-thumbnail.ps1 `
#       -Url "https://ajeet-iitk.github.io/MyNewGame/" -Name "my-new-game"
#
#   powershell -ExecutionPolicy Bypass -File tools/make-thumbnail.ps1 `
#       -Url "file:///C:/path/to/game.html" -Name "my-new-game"
#
# Output: thumbnails/<name>.jpg

param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$Name,
  [int]$Width = 1280,
  [int]$Height = 800,
  [int]$WaitMs = 12000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$thumbDir = Join-Path $root "thumbnails"
New-Item -ItemType Directory -Force -Path $thumbDir | Out-Null

$browsers = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) {
  throw "Chrome or Edge was not found. Install one, or take the screenshot manually."
}

# Accept a plain path as well as a URL.
if ($Url -notmatch '^[a-z]+://') {
  $Url = ([System.Uri](Resolve-Path $Url).Path).AbsoluteUri
}

$slug = ($Name.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
$dest = Join-Path $thumbDir "$slug.jpg"
$profile = Join-Path $env:TEMP ("thumb-shot-" + [guid]::NewGuid().ToString("N"))
$log = Join-Path $env:TEMP ("thumb-shot-" + [guid]::NewGuid().ToString("N") + ".log")

Write-Host "Capturing $Url"
Write-Host "  -> $dest"

# Chrome writes its progress to stderr, which PowerShell 5.1 turns into an
# error record. Relax the preference for the call and capture the log instead.
$previous = $ErrorActionPreference
$ErrorActionPreference = "Continue"

& $browser `
  --headless=new `
  --hide-scrollbars `
  --no-first-run `
  --no-default-browser-check `
  --disable-extensions `
  --allow-file-access-from-files `
  --user-data-dir="$profile" `
  --window-size="$Width,$Height" `
  --virtual-time-budget="$WaitMs" `
  --screenshot="$dest" `
  $Url 2> $log | Out-Null

$ErrorActionPreference = $previous

Start-Sleep -Milliseconds 800
Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue

if (-not (Test-Path $dest)) {
  if (Test-Path $log) { Get-Content $log | Select-Object -Last 5 | Write-Host }
  Remove-Item $log -Force -ErrorAction SilentlyContinue
  throw "Chrome did not produce a screenshot. Try again, or capture it manually."
}

Remove-Item $log -Force -ErrorAction SilentlyContinue

$size = [math]::Round((Get-Item $dest).Length / 1KB)
Write-Host "Done: $size KB"
