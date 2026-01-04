#!/bin/bash
#
# RealmOps Linux Update Script
# Updates RealmOps to the latest version
#
set -euo pipefail

# Configuration (should match install.sh)
INSTALL_DIR="/opt/realmops"
DATA_DIR="/var/lib/realmops"
REALMOPS_USER="realmops"
REALMOPS_REPO="${REALMOPS_REPO:-https://github.com/devnvll/realmops.git}"
REALMOPS_VERSION="${1:-main}"

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

check_installation() {
    if [ ! -d "$INSTALL_DIR" ]; then
        log_error "RealmOps is not installed at $INSTALL_DIR. Run install.sh first."
    fi
}

backup_current() {
    log_step "Creating backup..."

    BACKUP_DIR="/tmp/realmops-backup-$(date +%Y%m%d%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    cp -r "$INSTALL_DIR/bin" "$BACKUP_DIR/" 2>/dev/null || true
    cp -r "$INSTALL_DIR/frontend/dist" "$BACKUP_DIR/frontend-dist" 2>/dev/null || true
    cp -r "$INSTALL_DIR/frontend/server" "$BACKUP_DIR/frontend-server" 2>/dev/null || true

    log_info "Backup created at $BACKUP_DIR"
}

stop_services() {
    log_step "Stopping services..."

    systemctl stop realmops-frontend 2>/dev/null || true
    systemctl stop realmops-backend 2>/dev/null || true

    # Wait for services to stop
    sleep 2

    log_info "Services stopped"
}

download_source() {
    log_step "Downloading RealmOps $REALMOPS_VERSION..."

    rm -rf "$INSTALL_DIR/source"
    git clone --depth 1 --branch "$REALMOPS_VERSION" "$REALMOPS_REPO" "$INSTALL_DIR/source"

    log_info "Source downloaded"
}

build_backend() {
    log_step "Building backend..."

    cd "$INSTALL_DIR/source/backend"

    export CGO_ENABLED=1
    export PATH=$PATH:/usr/local/go/bin

    go build -ldflags="-s -w" -o "$INSTALL_DIR/bin/gsm" ./cmd/server

    chown "$REALMOPS_USER:$REALMOPS_USER" "$INSTALL_DIR/bin/gsm"
    chmod +x "$INSTALL_DIR/bin/gsm"

    log_info "Backend built successfully"
}

build_frontend() {
    log_step "Building frontend..."

    cd "$INSTALL_DIR/source/frontend"

    pnpm install --frozen-lockfile
    pnpm run build

    # Remove old frontend files
    rm -rf "$INSTALL_DIR/frontend/dist"
    rm -rf "$INSTALL_DIR/frontend/server"

    # Copy new files
    cp -r dist "$INSTALL_DIR/frontend/"
    cp -r server "$INSTALL_DIR/frontend/"
    cp package.json pnpm-lock.yaml "$INSTALL_DIR/frontend/"

    # Install production dependencies
    cd "$INSTALL_DIR/frontend"
    pnpm install --prod --frozen-lockfile

    chown -R "$REALMOPS_USER:$REALMOPS_USER" "$INSTALL_DIR/frontend"

    log_info "Frontend built successfully"
}

update_packs() {
    log_step "Updating game packs..."

    if [ -d "$INSTALL_DIR/source/packs" ]; then
        # Update packs but preserve any custom packs
        for pack in "$INSTALL_DIR/source/packs/"*/; do
            if [ -d "$pack" ]; then
                packname=$(basename "$pack")
                rm -rf "${INSTALL_DIR}/packs/${packname}"
                cp -r "$pack" "$INSTALL_DIR/packs/"
            fi
        done
        chown -R "$REALMOPS_USER:$REALMOPS_USER" "$INSTALL_DIR/packs"
    fi

    log_info "Game packs updated"
}

start_services() {
    log_step "Starting services..."

    systemctl start realmops-backend
    sleep 3
    systemctl start realmops-frontend

    log_info "Services started"
}

cleanup() {
    log_step "Cleaning up..."
    rm -rf "$INSTALL_DIR/source"
    log_info "Cleanup complete"
}

main() {
    echo "========================================"
    echo "RealmOps Updater"
    echo "========================================"
    echo ""
    echo "Updating to version: $REALMOPS_VERSION"
    echo ""

    check_root
    check_installation
    backup_current
    stop_services
    download_source
    build_backend
    build_frontend
    update_packs
    cleanup
    start_services

    echo ""
    echo "========================================"
    echo -e "${GREEN}Update complete!${NC}"
    echo "========================================"
    echo ""
    echo "Backup saved to: $BACKUP_DIR"
    echo "You can delete the backup after verifying the update works."
    echo ""
    echo "Check service status:"
    echo "  sudo systemctl status realmops-backend"
    echo "  sudo systemctl status realmops-frontend"
    echo ""
}

main "$@"
