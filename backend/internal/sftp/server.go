package sftp

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"sync"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
	"realmops/internal/config"
	"realmops/internal/db"
	"realmops/internal/packs"
	"realmops/internal/sshkeys"
)

// Server is the SFTP server
type Server struct {
	cfg              *config.Config
	db               *db.DB
	packLoader       *packs.Loader
	keyManager       *sshkeys.Manager
	configManager    *sshkeys.SFTPConfigManager
	sessionManager   *SessionManager
	hostKey          ssh.Signer
	listener         net.Listener
	wg               sync.WaitGroup
	shutdownCh       chan struct{}
	mu               sync.Mutex
}

// NewServer creates a new SFTP server
func NewServer(
	cfg *config.Config,
	database *db.DB,
	packLoader *packs.Loader,
	keyManager *sshkeys.Manager,
	configManager *sshkeys.SFTPConfigManager,
) (*Server, error) {
	hostKey, err := loadOrGenerateHostKey(cfg.SFTPHostKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load host key: %w", err)
	}

	return &Server{
		cfg:            cfg,
		db:             database,
		packLoader:     packLoader,
		keyManager:     keyManager,
		configManager:  configManager,
		sessionManager: NewSessionManager(database),
		hostKey:        hostKey,
		shutdownCh:     make(chan struct{}),
	}, nil
}

// Start starts the SFTP server
func (s *Server) Start(ctx context.Context) error {
	sshConfig := &ssh.ServerConfig{
		PublicKeyCallback: s.publicKeyCallback,
		PasswordCallback:  s.passwordCallback,
	}
	sshConfig.AddHostKey(s.hostKey)

	listener, err := net.Listen("tcp", s.cfg.SFTPPort)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", s.cfg.SFTPPort, err)
	}

	s.mu.Lock()
	s.listener = listener
	s.mu.Unlock()

	log.Printf("SFTP server listening on %s", s.cfg.SFTPPort)

	go func() {
		<-ctx.Done()
		s.Shutdown()
	}()

	for {
		conn, err := listener.Accept()
		if err != nil {
			select {
			case <-s.shutdownCh:
				return nil
			default:
				log.Printf("SFTP: failed to accept connection: %v", err)
				continue
			}
		}

		s.wg.Add(1)
		go func(conn net.Conn) {
			defer s.wg.Done()
			s.handleConnection(conn, sshConfig)
		}(conn)
	}
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown() {
	s.mu.Lock()
	defer s.mu.Unlock()

	close(s.shutdownCh)
	if s.listener != nil {
		s.listener.Close()
	}
	s.wg.Wait()
	log.Println("SFTP server stopped")
}

// GetHostFingerprint returns the host key fingerprint
func (s *Server) GetHostFingerprint() string {
	return ssh.FingerprintSHA256(s.hostKey.PublicKey())
}

// GetActiveSessions returns the number of active sessions
func (s *Server) GetActiveSessions() int {
	return s.sessionManager.ActiveCount()
}

func (s *Server) handleConnection(conn net.Conn, sshConfig *ssh.ServerConfig) {
	defer conn.Close()

	sshConn, chans, reqs, err := ssh.NewServerConn(conn, sshConfig)
	if err != nil {
		log.Printf("SFTP: SSH handshake failed: %v", err)
		return
	}
	defer sshConn.Close()

	// Get server ID from connection permissions
	serverID := sshConn.Permissions.Extensions["server_id"]
	if serverID == "" {
		log.Printf("SFTP: no server ID in connection")
		return
	}

	// Get pack ID for this server
	packID, err := s.getServerPackID(serverID)
	if err != nil {
		log.Printf("SFTP: failed to get pack ID: %v", err)
		return
	}

	// Create session
	session := s.sessionManager.Create(serverID, conn.RemoteAddr().String())
	defer s.sessionManager.End(session.ID)

	log.Printf("SFTP: connection from %s for server %s", conn.RemoteAddr(), serverID)

	// Discard global requests
	go ssh.DiscardRequests(reqs)

	// Handle channels
	for newChannel := range chans {
		if newChannel.ChannelType() != "session" {
			newChannel.Reject(ssh.UnknownChannelType, "unknown channel type")
			continue
		}

		channel, requests, err := newChannel.Accept()
		if err != nil {
			log.Printf("SFTP: failed to accept channel: %v", err)
			continue
		}

		go func(in <-chan *ssh.Request) {
			for req := range in {
				ok := false
				if req.Type == "subsystem" && string(req.Payload[4:]) == "sftp" {
					ok = true
				}
				req.Reply(ok, nil)
			}
		}(requests)

		s.handleSFTPChannel(channel, serverID, packID, session)
	}
}

func (s *Server) handleSFTPChannel(channel ssh.Channel, serverID, packID string, session *Session) {
	defer channel.Close()

	// Build paths
	serverDataDir := filepath.Join(s.cfg.DataDir, "servers", serverID, "data")
	packDir := filepath.Join(s.cfg.PacksDir, packID)

	// Create virtual filesystem handler
	vfs := NewVirtualFS(serverDataDir, packDir, session)

	// Create SFTP server with our virtual filesystem
	server := sftp.NewRequestServer(channel, sftp.Handlers{
		FileGet:  vfs,
		FilePut:  vfs,
		FileCmd:  vfs,
		FileList: vfs,
	})

	if err := server.Serve(); err != nil {
		if err != io.EOF {
			log.Printf("SFTP: server error: %v", err)
		}
	}
}

func (s *Server) publicKeyCallback(conn ssh.ConnMetadata, key ssh.PublicKey) (*ssh.Permissions, error) {
	username := conn.User()
	fingerprint := ssh.FingerprintSHA256(key)

	// Look up SFTP config by username
	sftpConfig, err := s.configManager.GetByUsername(username)
	if err != nil {
		log.Printf("SFTP: public key auth error for user %s: %v", username, err)
		return nil, fmt.Errorf("authentication failed")
	}
	if sftpConfig == nil {
		log.Printf("SFTP: public key auth - user %s not found (ensure you visited the SFTP tab in UI first)", username)
		return nil, fmt.Errorf("user not found")
	}

	// If no SSH key configured, reject public key auth
	if sftpConfig.SSHKeyID == nil {
		log.Printf("SFTP: public key auth - user %s has no SSH key configured, trying password auth next", username)
		return nil, fmt.Errorf("public key auth not configured")
	}

	// Validate the public key
	sshKey, err := s.keyManager.ValidatePublicKey(key)
	if err != nil {
		log.Printf("SFTP: key validation error for user %s: %v", username, err)
		return nil, fmt.Errorf("authentication failed")
	}
	if sshKey == nil {
		log.Printf("SFTP: public key auth - key with fingerprint %s not found in database", fingerprint)
		return nil, fmt.Errorf("key not found")
	}

	// Check if the key matches the one configured for this server
	if sshKey.ID != *sftpConfig.SSHKeyID {
		log.Printf("SFTP: public key auth - key %s not authorized for user %s (server uses key %s)", sshKey.ID, username, *sftpConfig.SSHKeyID)
		return nil, fmt.Errorf("key not authorized for this server")
	}

	// Update last used timestamp
	s.keyManager.UpdateLastUsed(sshKey.ID)

	log.Printf("SFTP: public key auth successful for user %s", username)
	return &ssh.Permissions{
		Extensions: map[string]string{
			"server_id": sftpConfig.ServerID,
		},
	}, nil
}

func (s *Server) passwordCallback(conn ssh.ConnMetadata, password []byte) (*ssh.Permissions, error) {
	username := conn.User()

	// Look up SFTP config by username
	sftpConfig, err := s.configManager.GetByUsername(username)
	if err != nil {
		log.Printf("SFTP: password auth error for user %s: %v", username, err)
		return nil, fmt.Errorf("authentication failed")
	}
	if sftpConfig == nil {
		log.Printf("SFTP: password auth - user %s not found (ensure you visited the SFTP tab in UI first)", username)
		return nil, fmt.Errorf("user not found")
	}

	// Validate password
	valid, err := s.configManager.ValidatePassword(sftpConfig.ServerID, string(password))
	if err != nil {
		log.Printf("SFTP: password validation error for user %s: %v", username, err)
		return nil, fmt.Errorf("authentication failed")
	}
	if !valid {
		log.Printf("SFTP: password auth - invalid password for user %s (hasPassword=%v)", username, sftpConfig.HasPassword)
		return nil, fmt.Errorf("invalid password")
	}

	log.Printf("SFTP: password auth successful for user %s", username)
	return &ssh.Permissions{
		Extensions: map[string]string{
			"server_id": sftpConfig.ServerID,
		},
	}, nil
}

func (s *Server) getServerPackID(serverID string) (string, error) {
	var packID string
	err := s.db.QueryRow("SELECT pack_id FROM servers WHERE id = ?", serverID).Scan(&packID)
	if err != nil {
		return "", err
	}
	return packID, nil
}

func loadOrGenerateHostKey(path string) (ssh.Signer, error) {
	// Try to load existing key
	keyData, err := os.ReadFile(path)
	if err == nil {
		signer, err := ssh.ParsePrivateKey(keyData)
		if err == nil {
			log.Printf("SFTP: loaded host key from %s", path)
			return signer, nil
		}
		log.Printf("SFTP: failed to parse existing host key: %v", err)
	}

	// Generate new ED25519 key
	log.Printf("SFTP: generating new host key at %s", path)
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate key: %w", err)
	}

	// Marshal to PEM
	pemBlock, err := ssh.MarshalPrivateKey(privateKey, "")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal private key: %w", err)
	}

	pemData := pem.EncodeToMemory(pemBlock)

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, fmt.Errorf("failed to create directory: %w", err)
	}

	// Write key file
	if err := os.WriteFile(path, pemData, 0600); err != nil {
		return nil, fmt.Errorf("failed to write key file: %w", err)
	}

	// Parse and return signer
	signer, err := ssh.ParsePrivateKey(pemData)
	if err != nil {
		return nil, fmt.Errorf("failed to parse generated key: %w", err)
	}

	return signer, nil
}
