# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RealmOps is a self-hosted game server management panel. It uses Docker to deploy and manage game servers (Minecraft, Rust, etc.) through a web interface.

## Commands

### Backend (Go)
```bash
cd backend
go run cmd/server/main.go    # Run dev server (localhost:8080)
go build -o gsm cmd/server/main.go  # Build binary
go test ./...                # Run tests
```

### Frontend (React/TypeScript)
```bash
cd frontend
pnpm install                 # Install dependencies
pnpm dev                     # Run dev server (localhost:3000) - starts both Vite and auth server
pnpm build                   # Production build
pnpm test                    # Run tests with vitest
```

### Docker
```bash
docker compose up -d         # Run full stack (frontend :3000, backend :8080)
```

### Adding UI Components
```bash
pnpm dlx shadcn@latest add <component>  # e.g., button, card, dialog
```

## Architecture

### Backend (`backend/`)
Go service using chi router with SQLite database.

- `cmd/server/main.go` - Entry point, initializes all components
- `internal/api/` - HTTP handlers and routing (`server.go` defines all routes)
- `internal/server/manager.go` - Core server lifecycle management (create, start, stop, delete)
- `internal/docker/provider.go` - Docker API wrapper for container operations
- `internal/packs/loader.go` - Loads game server pack definitions from YAML
- `internal/jobs/runner.go` - Background job queue for install/update/backup tasks
- `internal/sftp/` - Built-in SFTP server for file management
- `internal/rcon/` - RCON client for game server console commands
- `internal/ws/` - WebSocket handlers for real-time logs and console

### Frontend (`frontend/`)
React 19 with TanStack Router and Query. Uses Hono for the auth server.

- `server/` - Hono auth server using better-auth with SQLite
- `src/routes/` - File-based routing (TanStack Router)
  - `servers/` - Server list, creation, detail views
  - `packs/` - Game pack management
  - `settings/` - SSH keys, account, server settings
- `src/components/` - Shared UI components (shadcn/ui based)
- `src/lib/api.ts` - API client for backend communication

### Packs (`packs/`)
Game server definitions in YAML format. Each pack defines:
- Docker image and runtime config
- User-configurable variables
- Installation method (download JAR, etc.)
- Port mappings
- Start command with variable interpolation
- Health checks and shutdown behavior

See `packs/minecraft-java/pack.yaml` for a complete example.

## Key Patterns

- Backend authenticates via middleware that validates tokens against the frontend auth server
- Server operations (install, backup) run as async jobs - poll `/api/jobs/{id}` for status
- Real-time logs use WebSocket at `/api/servers/{id}/logs/stream`
- Console access via WebSocket at `/api/servers/{id}/console` (uses RCON when available)
- Pack variables use Go template syntax (`{{.variableName}}`) in commands and configs
