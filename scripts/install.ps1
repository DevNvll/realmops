#Requires -RunAsAdministrator
#Requires -Version 5.1

<#
.SYNOPSIS
    RealmOps Windows Installer

.DESCRIPTION
    Installs RealmOps game server management panel on Windows.
    Requires Docker Desktop to be installed and running.

.PARAMETER Version
    Version/branch to install. Defaults to 'main'.

.PARAMETER InstallDir
    Installation directory. Defaults to 'C:\Program Files\RealmOps'.

.PARAMETER DataDir
    Data directory. Defaults to 'C:\ProgramData\RealmOps'.

.PARAMETER RepoUrl
    Git repository URL. Defaults to 'https://github.com/your-org/realmops.git'.

.EXAMPLE
    .\install.ps1
    .\install.ps1 -Version "v1.0.0"
#>

param(
    [string]$Version = "main",
    [string]$InstallDir = "C:\Program Files\RealmOps",
    [string]$DataDir = "C:\ProgramData\RealmOps",
    [string]$RepoUrl = "https://github.com/devnvll/realmops.git"
)

$ErrorActionPreference = "Stop"

# Configuration
$MinGoVersion = "1.22"
$MinNodeVersion = "20"
$NssmVersion = "2.24"
$NssmUrl = "https://nssm.cc/release/nssm-$NssmVersion.zip"

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

function Test-Administrator {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Compare-Version {
    param([string]$Current, [string]$Minimum)
    $currentParts = $Current -split '\.' | ForEach-Object { [int]$_ }
    $minimumParts = $Minimum -split '\.' | ForEach-Object { [int]$_ }

    for ($i = 0; $i -lt [Math]::Max($currentParts.Length, $minimumParts.Length); $i++) {
        $c = if ($i -lt $currentParts.Length) { $currentParts[$i] } else { 0 }
        $m = if ($i -lt $minimumParts.Length) { $minimumParts[$i] } else { 0 }
        if ($c -gt $m) { return 1 }
        if ($c -lt $m) { return -1 }
    }
    return 0
}

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

#############################################
# Dependency Installation
#############################################

function Install-Go {
    Write-Step "Installing Go..."

    $goVersion = "1.22.3"
    $arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }
    $goUrl = "https://go.dev/dl/go$goVersion.windows-$arch.msi"
    $msiPath = "$env:TEMP\go.msi"

    Write-Info "Downloading Go $goVersion..."
    Invoke-WebRequest -Uri $goUrl -OutFile $msiPath -UseBasicParsing

    Write-Info "Installing Go..."
    Start-Process msiexec.exe -ArgumentList "/i", $msiPath, "/quiet", "/norestart" -Wait
    Remove-Item $msiPath -ErrorAction SilentlyContinue

    Refresh-Path

    Write-Info "Go installed successfully"
}

function Install-NodeJS {
    Write-Step "Installing Node.js..."

    if (Test-CommandExists winget) {
        Write-Info "Installing via winget..."
        winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    } else {
        $nodeVersion = "20.11.1"
        $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
        $nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-$arch.msi"
        $msiPath = "$env:TEMP\node.msi"

        Write-Info "Downloading Node.js $nodeVersion..."
        Invoke-WebRequest -Uri $nodeUrl -OutFile $msiPath -UseBasicParsing

        Write-Info "Installing Node.js..."
        Start-Process msiexec.exe -ArgumentList "/i", $msiPath, "/quiet", "/norestart" -Wait
        Remove-Item $msiPath -ErrorAction SilentlyContinue
    }

    Refresh-Path

    # Install pnpm
    Write-Info "Installing pnpm..."
    npm install -g pnpm

    Write-Info "Node.js installed successfully"
}

function Install-NSSM {
    Write-Step "Installing NSSM (service manager)..."

    $nssmDir = "$InstallDir\nssm"
    $zipPath = "$env:TEMP\nssm.zip"

    Write-Info "Downloading NSSM..."
    Invoke-WebRequest -Uri $NssmUrl -OutFile $zipPath -UseBasicParsing

    Write-Info "Extracting NSSM..."
    Expand-Archive -Path $zipPath -DestinationPath $env:TEMP -Force

    New-Item -ItemType Directory -Path $nssmDir -Force | Out-Null

    $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
    Copy-Item "$env:TEMP\nssm-$NssmVersion\$arch\nssm.exe" "$nssmDir\nssm.exe"

    Remove-Item $zipPath -ErrorAction SilentlyContinue
    Remove-Item "$env:TEMP\nssm-$NssmVersion" -Recurse -Force -ErrorAction SilentlyContinue

    Write-Info "NSSM installed to $nssmDir"
}

function Test-Docker {
    Write-Step "Checking Docker..."

    if (-not (Test-CommandExists docker)) {
        Write-Err "Docker is not installed. Please install Docker Desktop first: https://docs.docker.com/desktop/windows/install/"
    }

    try {
        docker info | Out-Null
    } catch {
        Write-Err "Docker daemon is not running. Please start Docker Desktop."
    }

    Write-Info "Docker is available"
}

#############################################
# Installation
#############################################

function New-Directories {
    Write-Step "Creating directories..."

    $dirs = @(
        $InstallDir,
        "$InstallDir\bin",
        "$InstallDir\frontend",
        "$InstallDir\packs",
        "$InstallDir\logs",
        $DataDir,
        "$DataDir\db",
        "$DataDir\servers",
        "$DataDir\cache",
        "$DataDir\auth"
    )

    foreach ($dir in $dirs) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    Write-Info "Directories created"
}

function Get-Source {
    Write-Step "Downloading RealmOps source..."

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

    # Copy built assets
    Copy-Item -Path "dist" -Destination "$InstallDir\frontend\" -Recurse -Force
    Copy-Item -Path "server" -Destination "$InstallDir\frontend\" -Recurse -Force
    Copy-Item -Path "package.json" -Destination "$InstallDir\frontend\"
    Copy-Item -Path "pnpm-lock.yaml" -Destination "$InstallDir\frontend\"

    # Install production dependencies
    Push-Location "$InstallDir\frontend"
    pnpm install --prod --frozen-lockfile
    Pop-Location

    Pop-Location

    Write-Info "Frontend built successfully"
}

function Copy-Packs {
    Write-Step "Copying game packs..."

    $sourcePacksDir = "$InstallDir\source\packs"
    if (Test-Path $sourcePacksDir) {
        Get-ChildItem $sourcePacksDir | Copy-Item -Destination "$InstallDir\packs\" -Recurse -Force
    }

    Write-Info "Game packs copied"
}

function New-Configuration {
    Write-Step "Generating configuration..."

    # Generate secure session secret
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $sessionSecret = [System.BitConverter]::ToString($bytes).Replace("-", "").ToLower()

    $configContent = @"
# RealmOps Configuration
# Generated on $(Get-Date)

# Backend settings
GSM_LISTEN_ADDR=:8080
GSM_DATA_DIR=$DataDir
GSM_PACKS_DIR=$InstallDir\packs
GSM_DOCKER_HOST=npipe:////./pipe/docker_engine
GSM_PORT_RANGE_START=20000
GSM_PORT_RANGE_END=40000
GSM_SESSION_SECRET=$sessionSecret
GSM_SFTP_ENABLED=true
GSM_SFTP_PORT=:2022

# Frontend settings
NODE_ENV=production
PORT=3000
DATA_DIR=$DataDir\auth
"@

    $configPath = "$DataDir\config.env"
    Set-Content -Path $configPath -Value $configContent

    Write-Info "Configuration saved to $configPath"
}

function Install-Services {
    Write-Step "Installing Windows services..."

    $nssm = "$InstallDir\nssm\nssm.exe"

    # Stop and remove existing services if they exist
    & $nssm stop RealmOps-Backend 2>$null
    & $nssm stop RealmOps-Frontend 2>$null
    Start-Sleep -Seconds 2
    & $nssm remove RealmOps-Backend confirm 2>$null
    & $nssm remove RealmOps-Frontend confirm 2>$null

    # Install backend service
    Write-Info "Installing backend service..."
    & $nssm install RealmOps-Backend "$InstallDir\bin\gsm.exe"
    & $nssm set RealmOps-Backend AppDirectory "$InstallDir\bin"
    & $nssm set RealmOps-Backend DisplayName "RealmOps Backend"
    & $nssm set RealmOps-Backend Description "RealmOps game server management backend"
    & $nssm set RealmOps-Backend Start SERVICE_AUTO_START
    & $nssm set RealmOps-Backend AppStdout "$InstallDir\logs\backend.log"
    & $nssm set RealmOps-Backend AppStderr "$InstallDir\logs\backend-error.log"
    & $nssm set RealmOps-Backend AppRotateFiles 1
    & $nssm set RealmOps-Backend AppRotateBytes 10485760

    # Set environment variables for backend
    & $nssm set RealmOps-Backend AppEnvironmentExtra `
        "GSM_LISTEN_ADDR=:8080" `
        "GSM_DATA_DIR=$DataDir" `
        "GSM_PACKS_DIR=$InstallDir\packs" `
        "GSM_DOCKER_HOST=npipe:////./pipe/docker_engine" `
        "GSM_PORT_RANGE_START=20000" `
        "GSM_PORT_RANGE_END=40000" `
        "GSM_SFTP_ENABLED=true" `
        "GSM_SFTP_PORT=:2022"

    # Install frontend service
    Write-Info "Installing frontend service..."
    $nodeExe = (Get-Command node).Source
    & $nssm install RealmOps-Frontend $nodeExe
    & $nssm set RealmOps-Frontend AppParameters "--import tsx server/index.ts"
    & $nssm set RealmOps-Frontend AppDirectory "$InstallDir\frontend"
    & $nssm set RealmOps-Frontend DisplayName "RealmOps Frontend"
    & $nssm set RealmOps-Frontend Description "RealmOps game server management frontend"
    & $nssm set RealmOps-Frontend Start SERVICE_AUTO_START
    & $nssm set RealmOps-Frontend DependOnService RealmOps-Backend
    & $nssm set RealmOps-Frontend AppStdout "$InstallDir\logs\frontend.log"
    & $nssm set RealmOps-Frontend AppStderr "$InstallDir\logs\frontend-error.log"
    & $nssm set RealmOps-Frontend AppRotateFiles 1
    & $nssm set RealmOps-Frontend AppRotateBytes 10485760

    # Set environment variables for frontend
    & $nssm set RealmOps-Frontend AppEnvironmentExtra `
        "NODE_ENV=production" `
        "PORT=3000" `
        "DATA_DIR=$DataDir\auth"

    # Start services
    Write-Info "Starting services..."
    & $nssm start RealmOps-Backend
    Start-Sleep -Seconds 3
    & $nssm start RealmOps-Frontend

    Write-Info "Services installed and started"
}

function Set-FirewallRules {
    Write-Step "Configuring firewall rules..."

    $rules = @(
        @{Name="RealmOps Frontend"; Port=3000; Description="RealmOps web interface"},
        @{Name="RealmOps Backend API"; Port=8080; Description="RealmOps backend API"},
        @{Name="RealmOps SFTP"; Port=2022; Description="RealmOps SFTP server"}
    )

    foreach ($rule in $rules) {
        # Remove existing rule if present
        Remove-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue

        # Add new rule
        New-NetFirewallRule -DisplayName $rule.Name `
            -Description $rule.Description `
            -Direction Inbound `
            -Protocol TCP `
            -LocalPort $rule.Port `
            -Action Allow | Out-Null

        Write-Info "Firewall rule added: $($rule.Name) (port $($rule.Port))"
    }
}

function Remove-Source {
    Write-Step "Cleaning up..."
    Remove-Item "$InstallDir\source" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Info "Cleanup complete"
}

function Show-Success {
    # Try to get local IP
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress
    if (-not $ip) {
        $ip = "localhost"
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "RealmOps installed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access the panel at: http://${ip}:3000"
    Write-Host ""
    Write-Host "Installation directory: $InstallDir"
    Write-Host "Data directory: $DataDir"
    Write-Host "Logs: $InstallDir\logs"
    Write-Host ""
    Write-Host "Service commands:"
    Write-Host "  Get-Service RealmOps-*"
    Write-Host "  Restart-Service RealmOps-Backend"
    Write-Host "  Restart-Service RealmOps-Frontend"
    Write-Host ""
    Write-Host "First-time setup:"
    Write-Host "  1. Open the web panel in your browser"
    Write-Host "  2. Create your admin account"
    Write-Host ""
}

#############################################
# Main
#############################################

function Main {
    Write-Host "========================================"
    Write-Host "RealmOps Windows Installer"
    Write-Host "========================================"
    Write-Host ""

    if (-not (Test-Administrator)) {
        Write-Err "This script must be run as Administrator"
    }

    # Check/install Go
    if (Test-CommandExists go) {
        $goVersion = ((go version) -replace 'go version go(\d+\.\d+).*', '$1')
        if ((Compare-Version $goVersion $MinGoVersion) -ge 0) {
            Write-Info "Go $goVersion is already installed"
        } else {
            Install-Go
        }
    } else {
        Install-Go
    }

    Refresh-Path

    # Check/install Node.js
    if (Test-CommandExists node) {
        $nodeVersion = ((node -v) -replace 'v(\d+).*', '$1')
        if ((Compare-Version $nodeVersion $MinNodeVersion) -ge 0) {
            Write-Info "Node.js v$nodeVersion is already installed"
            # Ensure pnpm is installed
            if (-not (Test-CommandExists pnpm)) {
                npm install -g pnpm
            }
        } else {
            Install-NodeJS
        }
    } else {
        Install-NodeJS
    }

    Refresh-Path

    Test-Docker

    New-Directories
    Install-NSSM
    Get-Source
    Build-Backend
    Build-Frontend
    Copy-Packs
    New-Configuration
    Install-Services
    Set-FirewallRules
    Remove-Source
    Show-Success
}

# Run main function
Main
