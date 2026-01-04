#Requires -RunAsAdministrator
#Requires -Version 5.1

<#
.SYNOPSIS
    RealmOps Windows Update Script

.DESCRIPTION
    Updates RealmOps to the latest version while preserving configuration and data.

.PARAMETER Version
    Version/branch to update to. Defaults to 'main'.

.EXAMPLE
    .\update.ps1
    .\update.ps1 -Version "v1.0.0"
#>

param(
    [string]$Version = "main",
    [string]$InstallDir = "C:\Program Files\RealmOps",
    [string]$RepoUrl = "https://github.com/devnvll/realmops.git"
)

$ErrorActionPreference = "Stop"

#############################################
# Helper Functions
#############################################

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

function Write-Step {
    param([string]$Message)
    Write-Host "[STEP] $Message" -ForegroundColor Cyan
}

#############################################
# Update Functions
#############################################

function Test-Installation {
    if (-not (Test-Path $InstallDir)) {
        Write-Err "RealmOps is not installed at $InstallDir. Run install.ps1 first."
    }
}

function New-Backup {
    Write-Step "Creating backup..."

    $backupDir = "$env:TEMP\realmops-backup-$(Get-Date -Format 'yyyyMMddHHmmss')"
    New-Item -ItemType Directory -Path $backupDir | Out-Null

    if (Test-Path "$InstallDir\bin") {
        Copy-Item -Path "$InstallDir\bin" -Destination $backupDir -Recurse
    }
    if (Test-Path "$InstallDir\frontend\dist") {
        Copy-Item -Path "$InstallDir\frontend\dist" -Destination "$backupDir\frontend-dist" -Recurse
    }
    if (Test-Path "$InstallDir\frontend\server") {
        Copy-Item -Path "$InstallDir\frontend\server" -Destination "$backupDir\frontend-server" -Recurse
    }

    $script:BackupDir = $backupDir
    Write-Info "Backup created at $backupDir"
}

function Stop-Services {
    Write-Step "Stopping services..."

    $nssm = "$InstallDir\nssm\nssm.exe"

    if (Test-Path $nssm) {
        & $nssm stop RealmOps-Frontend 2>$null
        & $nssm stop RealmOps-Backend 2>$null
        Start-Sleep -Seconds 2
    }

    Write-Info "Services stopped"
}

function Get-Source {
    Write-Step "Downloading RealmOps $Version..."

    $sourcePath = "$InstallDir\source"

    if (Test-Path $sourcePath) {
        Remove-Item $sourcePath -Recurse -Force
    }

    git clone --depth 1 --branch $Version $RepoUrl $sourcePath

    Write-Info "Source downloaded"
}

function Build-Backend {
    Write-Step "Building backend..."

    Push-Location "$InstallDir\source\backend"

    $env:CGO_ENABLED = "1"
    go build -ldflags="-s -w" -o "$InstallDir\bin\gsm.exe" ./cmd/server

    Pop-Location

    Write-Info "Backend built successfully"
}

function Build-Frontend {
    Write-Step "Building frontend..."

    Push-Location "$InstallDir\source\frontend"

    pnpm install --frozen-lockfile
    pnpm run build

    # Remove old frontend files
    Remove-Item "$InstallDir\frontend\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "$InstallDir\frontend\server" -Recurse -Force -ErrorAction SilentlyContinue

    # Copy new files
    Copy-Item -Path "dist" -Destination "$InstallDir\frontend\" -Recurse -Force
    Copy-Item -Path "server" -Destination "$InstallDir\frontend\" -Recurse -Force
    Copy-Item -Path "package.json" -Destination "$InstallDir\frontend\" -Force
    Copy-Item -Path "pnpm-lock.yaml" -Destination "$InstallDir\frontend\" -Force

    # Install production dependencies
    Push-Location "$InstallDir\frontend"
    pnpm install --prod --frozen-lockfile
    Pop-Location

    Pop-Location

    Write-Info "Frontend built successfully"
}

function Update-Packs {
    Write-Step "Updating game packs..."

    $sourcePacksDir = "$InstallDir\source\packs"
    if (Test-Path $sourcePacksDir) {
        Get-ChildItem $sourcePacksDir -Directory | ForEach-Object {
            $packName = $_.Name
            Remove-Item "$InstallDir\packs\$packName" -Recurse -Force -ErrorAction SilentlyContinue
            Copy-Item $_.FullName -Destination "$InstallDir\packs\" -Recurse
        }
    }

    Write-Info "Game packs updated"
}

function Start-Services {
    Write-Step "Starting services..."

    $nssm = "$InstallDir\nssm\nssm.exe"

    & $nssm start RealmOps-Backend
    Start-Sleep -Seconds 3
    & $nssm start RealmOps-Frontend

    Write-Info "Services started"
}

function Remove-Source {
    Write-Step "Cleaning up..."
    Remove-Item "$InstallDir\source" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Info "Cleanup complete"
}

#############################################
# Main
#############################################

function Main {
    Write-Host "========================================"
    Write-Host "RealmOps Updater"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Updating to version: $Version"
    Write-Host ""

    Test-Installation
    New-Backup
    Stop-Services
    Get-Source
    Build-Backend
    Build-Frontend
    Update-Packs
    Remove-Source
    Start-Services

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Update complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Backup saved to: $script:BackupDir"
    Write-Host "You can delete the backup after verifying the update works."
    Write-Host ""
    Write-Host "Check service status:"
    Write-Host "  Get-Service RealmOps-*"
    Write-Host ""
}

Main
