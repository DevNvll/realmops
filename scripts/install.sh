#!/bin/bash
#
# RealmOps Linux Installer
# Installs RealmOps game server management panel
#
set -euo pipefail

# Configuration
REALMOPS_VERSION="${REALMOPS_VERSION:-main}"
REALMOPS_REPO="${REALMOPS_REPO:-https://github.com/devnvll/realmops.git}"
INSTALL_DIR="/opt/realmops"
DATA_DIR="/var/lib/realmops"
CONFIG_DIR="/etc/realmops"
LOG_DIR="/var/log/realmops"
REALMOPS_USER="realmops"

# Minimum versions
MIN_GO_VERSION="1.22"
MIN_NODE_VERSION="20"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

#############################################
# Helper Functions
#############################################

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
    fi
}

detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        DISTRO_VERSION=${VERSION_ID:-""}
    else
        log_error "Cannot detect Linux distribution"
    fi
}

detect_arch() {
    ARCH=$(uname -m)
    case $ARCH in
        x86_64) ARCH="amd64" ;;
        aarch64) ARCH="arm64" ;;
        armv7l) ARCH="arm" ;;
        *) log_error "Unsupported architecture: $ARCH" ;;
    esac
}

version_gte() {
    # Returns 0 if $1 >= $2
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

command_exists() {
    command -v "$1" &> /dev/null
}

#############################################
# Dependency Installation
#############################################

install_build_deps() {
    log_step "Installing build dependencies..."

    case $DISTRO in
        ubuntu|debian)
            apt-get update -qq
            apt-get install -y -qq build-essential git wget curl ca-certificates
            ;;
        centos|rhel|fedora|rocky|almalinux)
            if command_exists dnf; then
                dnf groupinstall -y "Development Tools"
                dnf install -y git wget curl ca-certificates
            else
                yum groupinstall -y "Development Tools"
                yum install -y git wget curl ca-certificates
            fi
            ;;
        arch|manjaro)
            pacman -Sy --noconfirm base-devel git wget curl ca-certificates
            ;;
        alpine)
            apk add --no-cache build-base git wget curl ca-certificates
            ;;
        *)
            log_warn "Unknown distribution: $DISTRO. Attempting to continue..."
            ;;
    esac
}

install_go() {
    local GO_VERSION="1.22.3"
    local GO_URL="https://go.dev/dl/go${GO_VERSION}.linux-${ARCH}.tar.gz"

    log_step "Installing Go ${GO_VERSION}..."

    wget -q --show-progress "$GO_URL" -O /tmp/go.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf /tmp/go.tar.gz
    rm /tmp/go.tar.gz

    # Add to system PATH
    cat > /etc/profile.d/go.sh << 'EOF'
export PATH=$PATH:/usr/local/go/bin
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin
EOF

    export PATH=$PATH:/usr/local/go/bin

    log_info "Go installed successfully"
}

install_nodejs() {
    local NODE_MAJOR=20

    log_step "Installing Node.js ${NODE_MAJOR}..."

    case $DISTRO in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
            apt-get install -y -qq nodejs
            ;;
        centos|rhel|fedora|rocky|almalinux)
            curl -fsSL https://rpm.nodesource.com/setup_${NODE_MAJOR}.x | bash -
            if command_exists dnf; then
                dnf install -y nodejs
            else
                yum install -y nodejs
            fi
            ;;
        arch|manjaro)
            pacman -Sy --noconfirm nodejs npm
            ;;
        alpine)
            apk add --no-cache nodejs npm
            ;;
        *)
            log_error "Cannot automatically install Node.js on $DISTRO. Please install Node.js $NODE_MAJOR+ manually."
            ;;
    esac

    # Install pnpm
    npm install -g pnpm

    log_info "Node.js installed successfully"
}

check_docker() {
    log_step "Checking Docker..."

    if ! command_exists docker; then
        log_error "Docker is not installed. Please install Docker first: https://docs.docker.com/engine/install/"
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running or current user lacks permissions"
    fi

    log_info "Docker is available"
}

#############################################
# Installation
#############################################

create_user_and_dirs() {
    log_step "Creating system user and directories..."

    # Create system user if not exists
    if ! id "$REALMOPS_USER" &>/dev/null; then
        useradd --system --shell /bin/false --home-dir "$DATA_DIR" --create-home "$REALMOPS_USER"
    fi

    # Add user to docker group
    if getent group docker > /dev/null 2>&1; then
        usermod -aG docker "$REALMOPS_USER"
    fi

    # Create directories
    mkdir -p "$INSTALL_DIR"/{bin,frontend,packs}
    mkdir -p "$DATA_DIR"/{db,servers,cache,auth}
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR"

    # Set ownership
    chown -R "$REALMOPS_USER:$REALMOPS_USER" "$DATA_DIR"
    chown -R "$REALMOPS_USER:$REALMOPS_USER" "$LOG_DIR"

    log_info "Directories created"
}

download_source() {
    log_step "Downloading RealmOps source..."

    local SOURCE_DIR="$INSTALL_DIR/source"

    if [ -d "$SOURCE_DIR" ]; then
        rm -rf "$SOURCE_DIR"
    fi

    git clone --depth 1 --branch "$REALMOPS_VERSION" "$REALMOPS_REPO" "$SOURCE_DIR"

    log_info "Source downloaded"
}

build_backend() {
    log_step "Building backend..."

    cd "$INSTALL_DIR/source/backend"

    export CGO_ENABLED=1
    export PATH=$PATH:/usr/local/go/bin

    go build -ldflags="-s -w" -o "$INSTALL_DIR/bin/gsm" ./cmd/server

    # Set ownership
    chown "$REALMOPS_USER:$REALMOPS_USER" "$INSTALL_DIR/bin/gsm"
    chmod +x "$INSTALL_DIR/bin/gsm"

    log_info "Backend built successfully"
}

build_frontend() {
    log_step "Building frontend..."

    cd "$INSTALL_DIR/source/frontend"

    pnpm install --frozen-lockfile
    pnpm run build

    # Copy built assets
    cp -r dist "$INSTALL_DIR/frontend/"
    cp -r server "$INSTALL_DIR/frontend/"
    cp package.json pnpm-lock.yaml "$INSTALL_DIR/frontend/"

    # Install production dependencies in install dir
    cd "$INSTALL_DIR/frontend"
    pnpm install --prod --frozen-lockfile

    # Set ownership
    chown -R "$REALMOPS_USER:$REALMOPS_USER" "$INSTALL_DIR/frontend"

    log_info "Frontend built successfully"
}

copy_packs() {
    log_step "Copying game packs..."

    if [ -d "$INSTALL_DIR/source/packs" ]; then
        cp -r "$INSTALL_DIR/source/packs/"* "$INSTALL_DIR/packs/" 2>/dev/null || true
        chown -R "$REALMOPS_USER:$REALMOPS_USER" "$INSTALL_DIR/packs"
    fi

    log_info "Game packs copied"
}

generate_config() {
    log_step "Generating configuration..."

    # Generate secure session secret
    SESSION_SECRET=$(openssl rand -hex 32)

    cat > "$CONFIG_DIR/config.env" << EOF
# RealmOps Configuration
# Generated on $(date)

# Backend settings
GSM_LISTEN_ADDR=:8080
GSM_DATA_DIR=${DATA_DIR}
GSM_PACKS_DIR=${INSTALL_DIR}/packs
GSM_DOCKER_HOST=unix:///var/run/docker.sock
GSM_PORT_RANGE_START=20000
GSM_PORT_RANGE_END=40000
GSM_SESSION_SECRET=${SESSION_SECRET}
GSM_SFTP_ENABLED=true
GSM_SFTP_PORT=:2022

# Frontend settings
NODE_ENV=production
PORT=3000
DATA_DIR=${DATA_DIR}/auth
EOF

    chmod 600 "$CONFIG_DIR/config.env"
    chown "$REALMOPS_USER:$REALMOPS_USER" "$CONFIG_DIR/config.env"

    log_info "Configuration generated"
}

install_systemd_services() {
    log_step "Installing systemd services..."

    # Backend service
    cat > /etc/systemd/system/realmops-backend.service << EOF
[Unit]
Description=RealmOps Backend Server
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${REALMOPS_USER}
Group=${REALMOPS_USER}
EnvironmentFile=${CONFIG_DIR}/config.env
ExecStart=${INSTALL_DIR}/bin/gsm
Restart=always
RestartSec=5
StandardOutput=append:${LOG_DIR}/backend.log
StandardError=append:${LOG_DIR}/backend-error.log

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR} ${LOG_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    # Frontend service
    cat > /etc/systemd/system/realmops-frontend.service << EOF
[Unit]
Description=RealmOps Frontend Server
After=network.target realmops-backend.service
Wants=realmops-backend.service

[Service]
Type=simple
User=${REALMOPS_USER}
Group=${REALMOPS_USER}
WorkingDirectory=${INSTALL_DIR}/frontend
EnvironmentFile=${CONFIG_DIR}/config.env
ExecStart=/usr/bin/node --import tsx server/index.ts
Restart=always
RestartSec=5
StandardOutput=append:${LOG_DIR}/frontend.log
StandardError=append:${LOG_DIR}/frontend-error.log

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR} ${LOG_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable realmops-backend realmops-frontend
    systemctl start realmops-backend

    # Wait for backend to be ready
    sleep 3

    systemctl start realmops-frontend

    log_info "Services installed and started"
}

cleanup() {
    log_step "Cleaning up..."
    rm -rf "$INSTALL_DIR/source"
    log_info "Cleanup complete"
}

print_success() {
    local IP
    IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

    echo ""
    echo "========================================"
    echo -e "${GREEN}RealmOps installed successfully!${NC}"
    echo "========================================"
    echo ""
    echo "Access the panel at: http://${IP}:3000"
    echo ""
    echo "Configuration: ${CONFIG_DIR}/config.env"
    echo "Data directory: ${DATA_DIR}"
    echo "Logs: ${LOG_DIR}"
    echo ""
    echo "Service commands:"
    echo "  sudo systemctl status realmops-backend"
    echo "  sudo systemctl status realmops-frontend"
    echo "  sudo journalctl -u realmops-backend -f"
    echo "  sudo journalctl -u realmops-frontend -f"
    echo ""
    echo "First-time setup:"
    echo "  1. Open the web panel in your browser"
    echo "  2. Create your admin account"
    echo ""
}

#############################################
# Main
#############################################

main() {
    echo "========================================"
    echo "RealmOps Installer"
    echo "========================================"
    echo ""

    check_root
    detect_distro
    detect_arch

    log_info "Detected: $DISTRO ${DISTRO_VERSION:-''} ($ARCH)"

    install_build_deps

    # Check/install Go
    if command_exists go; then
        GO_CURRENT=$(go version | grep -oP 'go\K[0-9]+\.[0-9]+' || echo "0")
        if version_gte "$GO_CURRENT" "$MIN_GO_VERSION"; then
            log_info "Go $GO_CURRENT is already installed"
        else
            install_go
        fi
    else
        install_go
    fi

    # Check/install Node.js
    if command_exists node; then
        NODE_CURRENT=$(node -v | grep -oP 'v\K[0-9]+' || echo "0")
        if version_gte "$NODE_CURRENT" "$MIN_NODE_VERSION"; then
            log_info "Node.js v$NODE_CURRENT is already installed"
            # Ensure pnpm is installed
            if ! command_exists pnpm; then
                npm install -g pnpm
            fi
        else
            install_nodejs
        fi
    else
        install_nodejs
    fi

    check_docker

    create_user_and_dirs
    download_source
    build_backend
    build_frontend
    copy_packs
    generate_config
    install_systemd_services
    cleanup
    print_success
}

# Run main function
main "$@"
