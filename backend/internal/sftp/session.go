package sftp

import (
	"sync"
	"sync/atomic"
	"time"

	"realmops/internal/db"
)

// Session represents an active SFTP connection
type Session struct {
	ID              string
	ServerID        string
	RemoteAddr      string
	ConnectedAt     time.Time
	BytesUploaded   int64
	BytesDownloaded int64
}

// AddUpload atomically adds bytes to the upload counter
func (s *Session) AddUpload(bytes int64) {
	atomic.AddInt64(&s.BytesUploaded, bytes)
}

// AddDownload atomically adds bytes to the download counter
func (s *Session) AddDownload(bytes int64) {
	atomic.AddInt64(&s.BytesDownloaded, bytes)
}

// SessionManager tracks active SFTP sessions
type SessionManager struct {
	db       *db.DB
	sessions sync.Map
	counter  int64
}

// NewSessionManager creates a new session manager
func NewSessionManager(database *db.DB) *SessionManager {
	return &SessionManager{
		db: database,
	}
}

// Create creates a new session
func (m *SessionManager) Create(serverID, remoteAddr string) *Session {
	id := generateSessionID()

	session := &Session{
		ID:          id,
		ServerID:    serverID,
		RemoteAddr:  remoteAddr,
		ConnectedAt: time.Now(),
	}

	m.sessions.Store(id, session)

	// Log to database (optional, for audit trail)
	go m.logSessionStart(session)

	return session
}

// End ends a session and records final stats
func (m *SessionManager) End(sessionID string) {
	if val, ok := m.sessions.LoadAndDelete(sessionID); ok {
		session := val.(*Session)
		go m.logSessionEnd(session)
	}
}

// Get retrieves a session by ID
func (m *SessionManager) Get(sessionID string) *Session {
	if val, ok := m.sessions.Load(sessionID); ok {
		return val.(*Session)
	}
	return nil
}

// ActiveCount returns the number of active sessions
func (m *SessionManager) ActiveCount() int {
	count := 0
	m.sessions.Range(func(_, _ interface{}) bool {
		count++
		return true
	})
	return count
}

// ListActive returns all active sessions
func (m *SessionManager) ListActive() []*Session {
	var sessions []*Session
	m.sessions.Range(func(_, value interface{}) bool {
		sessions = append(sessions, value.(*Session))
		return true
	})
	return sessions
}

func (m *SessionManager) logSessionStart(session *Session) {
	// We could log to a database table here for audit purposes
	// For now, just tracking in memory
}

func (m *SessionManager) logSessionEnd(session *Session) {
	// We could update the database with session stats here
	// For now, just tracking in memory
}

func generateSessionID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
		time.Sleep(time.Nanosecond)
	}
	return string(b)
}
