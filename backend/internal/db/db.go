package db

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

func New(dbPath string) (*DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return &DB{db}, nil
}

func (db *DB) Migrate() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS game_packs (
			id TEXT PRIMARY KEY,
			pack_version INTEGER NOT NULL DEFAULT 1,
			source TEXT NOT NULL,
			manifest_json TEXT NOT NULL,
			installed_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS servers (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			pack_id TEXT NOT NULL,
			pack_version INTEGER NOT NULL,
			vars_json TEXT NOT NULL DEFAULT '{}',
			state TEXT NOT NULL DEFAULT 'stopped',
			desired_state TEXT NOT NULL DEFAULT 'stopped',
			docker_container_id TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (pack_id) REFERENCES game_packs(id)
		)`,

		`CREATE TABLE IF NOT EXISTS server_ports (
			server_id TEXT NOT NULL,
			name TEXT NOT NULL,
			protocol TEXT NOT NULL DEFAULT 'tcp',
			container_port INTEGER NOT NULL,
			host_port INTEGER NOT NULL,
			PRIMARY KEY (server_id, name),
			FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
		)`,

		`CREATE TABLE IF NOT EXISTS port_reservations (
			host_port INTEGER PRIMARY KEY,
			server_id TEXT NOT NULL,
			reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
		)`,

		`CREATE TABLE IF NOT EXISTS jobs (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			server_id TEXT,
			status TEXT NOT NULL DEFAULT 'pending',
			progress REAL NOT NULL DEFAULT 0,
			logs TEXT NOT NULL DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL
		)`,

		`CREATE TABLE IF NOT EXISTS mod_profiles (
			id TEXT PRIMARY KEY,
			server_id TEXT NOT NULL,
			name TEXT NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
		)`,

		`CREATE TABLE IF NOT EXISTS mod_profile_revisions (
			id TEXT PRIMARY KEY,
			profile_id TEXT NOT NULL,
			spec_json TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (profile_id) REFERENCES mod_profiles(id) ON DELETE CASCADE
		)`,

		`CREATE TABLE IF NOT EXISTS backups (
			id TEXT PRIMARY KEY,
			server_id TEXT NOT NULL,
			name TEXT NOT NULL,
			size_bytes INTEGER NOT NULL DEFAULT 0,
			path TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
		)`,

		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			expires_at DATETIME NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,

		`CREATE INDEX IF NOT EXISTS idx_servers_pack_id ON servers(pack_id)`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_server_id ON jobs(server_id)`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
		`CREATE INDEX IF NOT EXISTS idx_mod_profiles_server_id ON mod_profiles(server_id)`,
		`CREATE INDEX IF NOT EXISTS idx_backups_server_id ON backups(server_id)`,
	}

	for _, migration := range migrations {
		if _, err := db.Exec(migration); err != nil {
			return err
		}
	}

	return nil
}
