#Requires -RunAsAdministrator
#Requires -Version 5.1

<#
.SYNOPSIS
    RealmOps Windows Uninstaller

.DESCRIPTION
    Removes RealmOps from the system.

.PARAMETER RemoveData
    If specified, also removes all data (servers, databases, configuration).

.PARAMETER Force
    Skip confirmation prompts.

.EXAMPLE
    .\uninstall.ps1
    .\uninstall.ps1 -RemoveData
    .\uninstall.ps1 -Force -RemoveData
#>

param(
    [switch]$RemoveData,
    [switch]$Force,
    [string]$InstallDir = "C:\Program Files\RealmOps",
    [string]$DataDir = "C:\ProgramData\RealmOps"
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

function Write-Step {
    param([string]$Message)
    Write-Host "[STEP] $Message" -ForegroundColor Cyan
}

#############################################
# Uninstall Functions
#############################################

function Confirm-Uninstall {
    if ($Force) {
        return
    }

    Write-Host ""
    Write-Host "This will uninstall RealmOps from your system."
    Write-Host ""
    Write-Host "The following will be removed:"
    Write-Host "  - Windows services (RealmOps-Backend, RealmOps-Frontend)"
    Write-Host "  - Application files ($InstallDir)"
    Write-Host "  - Firewall rules"
    Write-Host ""

    $response = Read-Host "Do you want to continue? [y/N]"
    if ($response -notmatch '^[Yy]') {
        Write-Host "Uninstall cancelled."
        exit 0
    }
}

function Confirm-DataRemoval {
    if ($RemoveData) {
        return $true
    }

    if ($Force) {
        return $false
    }

    Write-Host ""
    $response = Read-Host "Do you also want to remove all data (servers, databases, configuration)? [y/N]"
    return ($response -match '^[Yy]')
}

function Stop-Services {
    Write-Step "Stopping services..."

    $nssm = "$InstallDir\nssm\nssm.exe"

    if (Test-Path $nssm) {
        & $nssm stop RealmOps-Frontend 2>$null
        & $nssm stop RealmOps-Backend 2>$null
        Start-Sleep -Seconds 2
    }

    # Also try with native commands
    Stop-Service -Name "RealmOps-Frontend" -ErrorAction SilentlyContinue
    Stop-Service -Name "RealmOps-Backend" -ErrorAction SilentlyContinue

    Write-Info "Services stopped"
}

function Remove-Services {
    Write-Step "Removing Windows services..."

    $nssm = "$InstallDir\nssm\nssm.exe"

    if (Test-Path $nssm) {
        & $nssm remove RealmOps-Frontend confirm 2>$null
        & $nssm remove RealmOps-Backend confirm 2>$null
    }

    # Also try with native commands as fallback
    sc.exe delete RealmOps-Frontend 2>$null
    sc.exe delete RealmOps-Backend 2>$null

    Write-Info "Windows services removed"
}

function Remove-FirewallRules {
    Write-Step "Removing firewall rules..."

    $rules = @(
        "RealmOps Frontend",
        "RealmOps Backend API",
        "RealmOps SFTP"
    )

    foreach ($rule in $rules) {
        Remove-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue
    }

    Write-Info "Firewall rules removed"
}

function Remove-Application {
    Write-Step "Removing application files..."

    if (Test-Path $InstallDir) {
        Remove-Item $InstallDir -Recurse -Force
    }

    Write-Info "Application files removed"
}

function Remove-Data {
    param([bool]$ShouldRemove)

    if ($ShouldRemove) {
        Write-Step "Removing data files..."

        if (Test-Path $DataDir) {
            Remove-Item $DataDir -Recurse -Force
        }

        Write-Info "Data files removed"
    } else {
        Write-Info "Data files preserved at $DataDir"
    }
}

#############################################
# Main
#############################################

function Main {
    Write-Host "========================================"
    Write-Host "RealmOps Uninstaller"
    Write-Host "========================================"

    Confirm-Uninstall
    $shouldRemoveData = Confirm-DataRemoval

    Stop-Services
    Remove-Services
    Remove-FirewallRules
    Remove-Application
    Remove-Data -ShouldRemove $shouldRemoveData

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "RealmOps has been uninstalled." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""

    if (-not $shouldRemoveData) {
        Write-Host "Data has been preserved. To completely remove all data, run:"
        Write-Host "  Remove-Item '$DataDir' -Recurse -Force"
        Write-Host ""
    }
}

Main
