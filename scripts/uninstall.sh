#!/bin/bash
#
# RealmOps Linux Uninstaller
# Removes RealmOps from the system
#
set -euo pipefail

# Configuration (should match install.sh)
INSTALL_DIR="/opt/realmops"
DATA_DIR="/var/lib/realmops"
CONFIG_DIR="/etc/realmops"
LOG_DIR="/var/log/realmops"
REALMOPS_USER="realmops"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
    fi
}

confirm_uninstall() {
    echo ""
    echo "This will uninstall RealmOps from your system."
    echo ""
    echo "The following will be removed:"
    echo "  - Systemd services (realmops-backend, realmops-frontend)"
    echo "  - Application files ($INSTALL_DIR)"
    echo "  - Log files ($LOG_DIR)"
    echo ""

    read -p "Do you want to continue? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Uninstall cancelled."
        exit 0
    fi
}

confirm_data_removal() {
    echo ""
    read -p "Do you also want to remove all data (servers, databases, configuration)? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        REMOVE_DATA=true
    else
        REMOVE_DATA=false
    fi
}

stop_services() {
    log_step "Stopping services..."

    systemctl stop realmops-frontend 2>/dev/null || true
    systemctl stop realmops-backend 2>/dev/null || true

    systemctl disable realmops-frontend 2>/dev/null || true
    systemctl disable realmops-backend 2>/dev/null || true

    log_info "Services stopped and disabled"
}

remove_services() {
    log_step "Removing systemd services..."

    rm -f /etc/systemd/system/realmops-backend.service
    rm -f /etc/systemd/system/realmops-frontend.service

    systemctl daemon-reload

    log_info "Systemd services removed"
}

remove_application() {
    log_step "Removing application files..."

    rm -rf "$INSTALL_DIR"
    rm -rf "$LOG_DIR"

    log_info "Application files removed"
}

remove_data() {
    if [ "$REMOVE_DATA" = true ]; then
        log_step "Removing data files..."

        rm -rf "$DATA_DIR"
        rm -rf "$CONFIG_DIR"

        log_info "Data files removed"
    else
        log_info "Data files preserved at $DATA_DIR"
        log_info "Configuration preserved at $CONFIG_DIR"
    fi
}

remove_user() {
    log_step "Removing system user..."

    if id "$REALMOPS_USER" &>/dev/null; then
        userdel "$REALMOPS_USER" 2>/dev/null || true
        log_info "System user removed"
    fi
}

main() {
    echo "========================================"
    echo "RealmOps Uninstaller"
    echo "========================================"

    check_root
    confirm_uninstall
    confirm_data_removal

    stop_services
    remove_services
    remove_application
    remove_data

    if [ "$REMOVE_DATA" = true ]; then
        remove_user
    fi

    echo ""
    echo "========================================"
    echo -e "${GREEN}RealmOps has been uninstalled.${NC}"
    echo "========================================"
    echo ""

    if [ "$REMOVE_DATA" = false ]; then
        echo "Data has been preserved. To completely remove all data, run:"
        echo "  sudo rm -rf $DATA_DIR $CONFIG_DIR"
        echo ""
    fi
}

main "$@"
