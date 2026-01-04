# RealmOps

A self-hosted game server management panel. Deploy and manage game servers through a clean web interface with Docker under the hood.

## What it does

- Spin up game servers from pre-configured packs (Minecraft, Valheim, etc.)
- Start, stop, restart servers with one click
- Access server consoles and logs in real-time
- Manage server files via built-in SFTP
- RCON support for supported games

## Dev Setup

You'll need:
- Go 1.21+
- Node.js 20+
- pnpm
- Docker

### Backend

```bash
cd backend
go mod download
go run cmd/server/main.go
```

The API runs on `localhost:8080` by default.

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Opens on `localhost:5173`.

### Environment

Copy `.env.example` to `.env` and tweak as needed. The defaults work fine for local dev.

### Docker (production)

```bash
docker compose up -d
```

This builds both services and runs everything. Frontend at `:3000`, backend at `:8080`.

## License

MIT
