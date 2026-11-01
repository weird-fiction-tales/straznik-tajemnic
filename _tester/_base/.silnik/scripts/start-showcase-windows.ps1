param(
    [ValidateRange(1024, 65535)][int]$Port = 4050,
    [string]$DataDirectory = ""
)
$ErrorActionPreference = "Stop"
if ($env:OS -ne "Windows_NT") { throw "This launcher requires Windows." }
$GameDirectory = Split-Path -Parent $PSScriptRoot
Push-Location $GameDirectory
try {
    if (-not (Test-Path "node_modules/next/package.json")) { throw "Run npm ci in _tester/_base/.silnik first." }
    if (-not (Test-Path ".next/BUILD_ID")) { throw "Run npm run build in _tester/_base/.silnik first." }
    $Version = (& node -p "require('./package.json').version").Trim()
    if ($LASTEXITCODE -ne 0) { throw "Node.js did not start." }
    $Revision = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Cannot determine the Git revision." }
    if ([string]::IsNullOrWhiteSpace($DataDirectory)) {
        $DataDirectory = Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "StraznikTajemnicShowcase"
    }
    $env:ZEW_DATA_DIR = [IO.Path]::GetFullPath($DataDirectory)
    $env:RAG_DATA_DIR = Join-Path $env:ZEW_DATA_DIR "rag"
    $env:ZEW_SHOWCASE_PORT = [string]$Port
    $Info = @{
        version = "$Version-showcase.windows"
        channel = "showcase"
        commitSha = $Revision
        shortCommit = $Revision.Substring(0, 7)
        builtAt = [DateTime]::UtcNow.ToString("o")
        buildId = (Get-Content ".next/BUILD_ID" -Raw).Trim()
    }
    [IO.File]::WriteAllText(
        (Join-Path $GameDirectory "build-info.json"),
        ($Info | ConvertTo-Json),
        (New-Object Text.UTF8Encoding($false))
    )
    Write-Host "Showcase PL/EN: http://127.0.0.1:$Port/pl"
    Write-Host "English: http://127.0.0.1:$Port/en"
    & node "scripts/start-showcase.mjs"
    if ($LASTEXITCODE -ne 0) { throw "Showcase server exited with code $LASTEXITCODE." }
} finally {
    Pop-Location
}
