package sshkeys

import (
	"database/sql"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
	"realmops/internal/db"
)

// SFTPConfig represents the SFTP configuration for a server
type SFTPConfig struct {
	ServerID     string     `json:"serverId"`
	Enabled      bool       `json:"enabled"`
	SSHKeyID     *string    `json:"sshKeyId,omitempty"`
	SSHKeyName   *string    `json:"sshKeyName,omitempty"`
	HasPassword  bool       `json:"hasPassword"`
	SFTPUsername string     `json:"username"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

// SFTPConfigManager handles server SFTP configuration
type SFTPConfigManager struct {
	db *db.DB
}

// NewSFTPConfigManager creates a new SFTP config manager
func NewSFTPConfigManager(database *db.DB) *SFTPConfigManager {
	return &SFTPConfigManager{db: database}
}

// Get retrieves the SFTP config for a server
func (m *SFTPConfigManager) Get(serverID string) (*SFTPConfig, error) {
	config := &SFTPConfig{}
	var sshKeyID, sshKeyName sql.NullString
	var passwordHash sql.NullString

	err := m.db.QueryRow(`
		SELECT
			sc.server_id, sc.enabled, sc.ssh_key_id, sc.password_hash,
			sc.sftp_username, sc.created_at, sc.updated_at,
			sk.name as ssh_key_name
		FROM server_sftp_config sc
		LEFT JOIN ssh_keys sk ON sc.ssh_key_id = sk.id
		WHERE sc.server_id = ?
	`, serverID).Scan(
		&config.ServerID,
		&config.Enabled,
		&sshKeyID,
		&passwordHash,
		&config.SFTPUsername,
		&config.CreatedAt,
		&config.UpdatedAt,
		&sshKeyName,
	)

	if err == sql.ErrNoRows {
		return nil, nil // No config exists yet
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get SFTP config: %w", err)
	}

	if sshKeyID.Valid {
		config.SSHKeyID = &sshKeyID.String
	}
	if sshKeyName.Valid {
		config.SSHKeyName = &sshKeyName.String
	}
	config.HasPassword = passwordHash.Valid && passwordHash.String != ""

	return config, nil
}

// GetOrCreate retrieves the SFTP config or creates a default one
func (m *SFTPConfigManager) GetOrCreate(serverID string) (*SFTPConfig, error) {
	config, err := m.Get(serverID)
	if err != nil {
		return nil, err
	}

	if config != nil {
		return config, nil
	}

	// Create default config
	return m.Create(serverID, fmt.Sprintf("srv_%s", serverID))
}

// Create creates a new SFTP config for a server
func (m *SFTPConfigManager) Create(serverID, username string) (*SFTPConfig, error) {
	now := time.Now()

	_, err := m.db.Exec(`
		INSERT INTO server_sftp_config (server_id, enabled, sftp_username, created_at, updated_at)
		VALUES (?, 1, ?, ?, ?)
	`, serverID, username, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create SFTP config: %w", err)
	}

	return &SFTPConfig{
		ServerID:     serverID,
		Enabled:      true,
		SFTPUsername: username,
		HasPassword:  false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

// Update updates the SFTP config for a server
func (m *SFTPConfigManager) Update(serverID string, enabled bool, sshKeyID *string) error {
	now := time.Now()

	_, err := m.db.Exec(`
		UPDATE server_sftp_config
		SET enabled = ?, ssh_key_id = ?, updated_at = ?
		WHERE server_id = ?
	`, enabled, sshKeyID, now, serverID)
	if err != nil {
		return fmt.Errorf("failed to update SFTP config: %w", err)
	}

	return nil
}

// SetPassword sets or updates the SFTP password for a server
func (m *SFTPConfigManager) SetPassword(serverID, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	now := time.Now()

	_, err = m.db.Exec(`
		UPDATE server_sftp_config
		SET password_hash = ?, updated_at = ?
		WHERE server_id = ?
	`, string(hash), now, serverID)
	if err != nil {
		return fmt.Errorf("failed to set password: %w", err)
	}

	return nil
}

// ValidatePassword checks if the provided password is correct for a server
func (m *SFTPConfigManager) ValidatePassword(serverID, password string) (bool, error) {
	var passwordHash sql.NullString

	err := m.db.QueryRow(`
		SELECT password_hash FROM server_sftp_config WHERE server_id = ? AND enabled = 1
	`, serverID).Scan(&passwordHash)

	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to get password hash: %w", err)
	}

	if !passwordHash.Valid || passwordHash.String == "" {
		return false, nil
	}

	err = bcrypt.CompareHashAndPassword([]byte(passwordHash.String), []byte(password))
	return err == nil, nil
}

// GetByUsername retrieves server ID and config by SFTP username
func (m *SFTPConfigManager) GetByUsername(username string) (*SFTPConfig, error) {
	config := &SFTPConfig{}
	var sshKeyID sql.NullString
	var passwordHash sql.NullString

	err := m.db.QueryRow(`
		SELECT server_id, enabled, ssh_key_id, password_hash, sftp_username, created_at, updated_at
		FROM server_sftp_config
		WHERE sftp_username = ? AND enabled = 1
	`, username).Scan(
		&config.ServerID,
		&config.Enabled,
		&sshKeyID,
		&passwordHash,
		&config.SFTPUsername,
		&config.CreatedAt,
		&config.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get SFTP config by username: %w", err)
	}

	if sshKeyID.Valid {
		config.SSHKeyID = &sshKeyID.String
	}
	config.HasPassword = passwordHash.Valid && passwordHash.String != ""

	return config, nil
}

// Delete removes the SFTP config for a server (called automatically via CASCADE)
func (m *SFTPConfigManager) Delete(serverID string) error {
	_, err := m.db.Exec(`DELETE FROM server_sftp_config WHERE server_id = ?`, serverID)
	if err != nil {
		return fmt.Errorf("failed to delete SFTP config: %w", err)
	}
	return nil
}
