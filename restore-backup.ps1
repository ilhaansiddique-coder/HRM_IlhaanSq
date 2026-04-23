param(
    [Parameter(Mandatory = $false)]
    [string]$BackupDir,

    [Parameter(Mandatory = $false)]
    [string]$DbUrl = $env:SUPABASE_DB_URL,

    [Parameter(Mandatory = $false)]
    [switch]$SkipRoles
)

$ErrorActionPreference = "Stop"

function Require-File {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Required file not found: $Path"
    }
}

if (-not $DbUrl) {
    throw "Database URL is required. Set SUPABASE_DB_URL or pass -DbUrl."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is required because local 'psql' is not installed."
}

$projectRoot = (Resolve-Path ".").Path

if (-not $BackupDir) {
    $backupsRoot = Join-Path $projectRoot "Backups"
    if (-not (Test-Path -LiteralPath $backupsRoot -PathType Container)) {
        throw "Backups directory not found: $backupsRoot"
    }

    $latest = Get-ChildItem -LiteralPath $backupsRoot -Directory |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $latest) {
        throw "No backup folder found in: $backupsRoot"
    }

    $BackupDir = $latest.FullName
}

$resolvedBackupDir = Resolve-Path -LiteralPath $BackupDir
$rolesFile = Join-Path $resolvedBackupDir "roles.sql"
$schemaFile = Join-Path $resolvedBackupDir "schema.sql"
$dataFile = Join-Path $resolvedBackupDir "data.sql"

if (-not $SkipRoles) {
    Require-File -Path $rolesFile
}
Require-File -Path $schemaFile
Require-File -Path $dataFile

function Invoke-PsqlFile {
    param(
        [string]$FilePath,
        [string]$Label
    )

    $resolvedFile = (Resolve-Path -LiteralPath $FilePath).Path
    $containerFile = "/work/" + ($resolvedFile.Substring($projectRoot.Length).TrimStart('\') -replace '\\', '/')

    Write-Host "Applying ${Label}: $resolvedFile" -ForegroundColor Cyan
    & docker run --rm `
        -v "${projectRoot}:/work" `
        postgres:17 `
        psql "$DbUrl" `
        -v ON_ERROR_STOP=1 `
        -f "$containerFile"

    if ($LASTEXITCODE -ne 0) {
        throw "Failed while applying $Label ($resolvedFile)"
    }
}

if (-not $SkipRoles) {
    Invoke-PsqlFile -FilePath $rolesFile -Label "roles"
}
Invoke-PsqlFile -FilePath $schemaFile -Label "schema"
Invoke-PsqlFile -FilePath $dataFile -Label "data"

Write-Host "Restore completed successfully." -ForegroundColor Green
