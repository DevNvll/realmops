package sshkeys

import (
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
	"realmops/internal/db"
)

// SSHKey represents a stored SSH public key
type SSHKey struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	PublicKey   string     `json:"publicKey"`
	Fingerprint string     `json:"fingerprint"`
	KeyType     string     `json:"keyType"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastUsedAt  *time.Time `json:"lastUsedAt,omitempty"`
}

// Manager handles SSH key operations
type Manager struct {
	db *db.DB
}

// NewManager creates a new SSH key manager
func NewManager(database *db.DB) *Manager {
	return &Manager{db: database}
}

// ParsePublicKey parses an OpenSSH public key and extracts metadata
func ParsePublicKey(publicKeyStr string) (keyType, fingerprint string, err error) {
	// Parse the public key
	pubKey, _, _, _, err := ssh.ParseAuthorizedKey([]byte(publicKeyStr))
	if err != nil {
		return "", "", fmt.Errorf("invalid SSH public key: %w", err)
	}

	// Get key type
	keyType = pubKey.Type()

	// Calculate SHA256 fingerprint
	hash := sha256.Sum256(pubKey.Marshal())
	fingerprint = "SHA256:" + base64.StdEncoding.EncodeToString(hash[:])
	// Remove trailing padding for standard fingerprint format
	fingerprint = strings.TrimRight(fingerprint, "=")

	return keyType, fingerprint, nil
}

// Create adds a new SSH key
func (m *Manager) Create(id, name, publicKey string) (*SSHKey, error) {
	// Normalize the public key (trim whitespace)
	publicKey = strings.TrimSpace(publicKey)

	// Parse and validate the key
	keyType, fingerprint, err := ParsePublicKey(publicKey)
	if err != nil {
		return nil, err
	}

	now := time.Now()

	_, err = m.db.Exec(`
		INSERT INTO ssh_keys (id, name, public_key, fingerprint, key_type, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, name, publicKey, fingerprint, keyType, now)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, fmt.Errorf("SSH key with this fingerprint already exists")
		}
		return nil, fmt.Errorf("failed to create SSH key: %w", err)
	}

	return &SSHKey{
		ID:          id,
		Name:        name,
		PublicKey:   publicKey,
		Fingerprint: fingerprint,
		KeyType:     keyType,
		CreatedAt:   now,
	}, nil
}

// List returns all SSH keys
func (m *Manager) List() ([]*SSHKey, error) {
	rows, err := m.db.Query(`
		SELECT id, name, public_key, fingerprint, key_type, created_at, last_used_at
		FROM ssh_keys
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list SSH keys: %w", err)
	}
	defer rows.Close()

	var keys []*SSHKey
	for rows.Next() {
		key := &SSHKey{}
		var lastUsedAt sql.NullTime
		err := rows.Scan(
			&key.ID,
			&key.Name,
			&key.PublicKey,
			&key.Fingerprint,
			&key.KeyType,
			&key.CreatedAt,
			&lastUsedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan SSH key: %w", err)
		}
		if lastUsedAt.Valid {
			key.LastUsedAt = &lastUsedAt.Time
		}
		keys = append(keys, key)
	}

	return keys, nil
}

// Get retrieves a specific SSH key by ID
func (m *Manager) Get(id string) (*SSHKey, error) {
	key := &SSHKey{}
	var lastUsedAt sql.NullTime

	err := m.db.QueryRow(`
		SELECT id, name, public_key, fingerprint, key_type, created_at, last_used_at
		FROM ssh_keys
		WHERE id = ?
	`, id).Scan(
		&key.ID,
		&key.Name,
		&key.PublicKey,
		&key.Fingerprint,
		&key.KeyType,
		&key.CreatedAt,
		&lastUsedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("SSH key not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get SSH key: %w", err)
	}

	if lastUsedAt.Valid {
		key.LastUsedAt = &lastUsedAt.Time
	}

	return key, nil
}

// GetByFingerprint retrieves an SSH key by its fingerprint
func (m *Manager) GetByFingerprint(fingerprint string) (*SSHKey, error) {
	key := &SSHKey{}
	var lastUsedAt sql.NullTime

	err := m.db.QueryRow(`
		SELECT id, name, public_key, fingerprint, key_type, created_at, last_used_at
		FROM ssh_keys
		WHERE fingerprint = ?
	`, fingerprint).Scan(
		&key.ID,
		&key.Name,
		&key.PublicKey,
		&key.Fingerprint,
		&key.KeyType,
		&key.CreatedAt,
		&lastUsedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil // Not found, but not an error
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get SSH key by fingerprint: %w", err)
	}

	if lastUsedAt.Valid {
		key.LastUsedAt = &lastUsedAt.Time
	}

	return key, nil
}

// Delete removes an SSH key
func (m *Manager) Delete(id string) error {
	result, err := m.db.Exec(`DELETE FROM ssh_keys WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to delete SSH key: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("SSH key not found")
	}

	return nil
}

// UpdateLastUsed updates the last_used_at timestamp for a key
func (m *Manager) UpdateLastUsed(id string) error {
	_, err := m.db.Exec(`
		UPDATE ssh_keys SET last_used_at = ? WHERE id = ?
	`, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update last used: %w", err)
	}
	return nil
}

// ValidatePublicKey checks if a public key matches any stored key
// Returns the matching SSHKey or nil if no match
func (m *Manager) ValidatePublicKey(pubKey ssh.PublicKey) (*SSHKey, error) {
	// Calculate fingerprint of the presented key
	hash := sha256.Sum256(pubKey.Marshal())
	fingerprint := "SHA256:" + base64.StdEncoding.EncodeToString(hash[:])
	fingerprint = strings.TrimRight(fingerprint, "=")

	return m.GetByFingerprint(fingerprint)
}
