package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

type User struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type Session struct {
	User      *User     `json:"user"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type sessionResponse struct {
	Session *struct {
		ID        string    `json:"id"`
		UserID    string    `json:"userId"`
		ExpiresAt time.Time `json:"expiresAt"`
	} `json:"session"`
	User *User `json:"user"`
}

type contextKey string

const userContextKey contextKey = "user"

type Middleware struct {
	authServiceURL string
	client         *http.Client
	cache          sync.Map
	cacheTTL       time.Duration
}

type cachedSession struct {
	user      *User
	expiresAt time.Time
	cachedAt  time.Time
}

func NewMiddleware(authServiceURL string) *Middleware {
	return &Middleware{
		authServiceURL: authServiceURL,
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		cacheTTL: 5 * time.Minute,
	}
}

func (m *Middleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, err := m.validateSession(r)
		if err != nil || user == nil {
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (m *Middleware) validateSession(r *http.Request) (*User, error) {
	// Get session token from cookie
	cookie, err := r.Cookie("better-auth.session_token")
	if err != nil {
		return nil, fmt.Errorf("no session cookie: %w", err)
	}

	token := cookie.Value
	if token == "" {
		return nil, fmt.Errorf("empty session token")
	}

	// Check cache first
	if cached, ok := m.cache.Load(token); ok {
		cs := cached.(*cachedSession)
		if time.Since(cs.cachedAt) < m.cacheTTL && time.Now().Before(cs.expiresAt) {
			return cs.user, nil
		}
		m.cache.Delete(token)
	}

	// Call auth service to validate session
	req, err := http.NewRequest("GET", m.authServiceURL+"/api/auth/get-session", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Forward the session cookie
	req.AddCookie(cookie)

	resp, err := m.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call auth service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("auth service returned status %d", resp.StatusCode)
	}

	var sessionResp sessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&sessionResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if sessionResp.User == nil || sessionResp.Session == nil {
		return nil, fmt.Errorf("no session found")
	}

	// Cache the valid session
	m.cache.Store(token, &cachedSession{
		user:      sessionResp.User,
		expiresAt: sessionResp.Session.ExpiresAt,
		cachedAt:  time.Now(),
	})

	return sessionResp.User, nil
}

// GetUser retrieves the authenticated user from the request context
func GetUser(ctx context.Context) *User {
	if user, ok := ctx.Value(userContextKey).(*User); ok {
		return user
	}
	return nil
}

// Optional creates middleware that allows unauthenticated requests but sets user if available
func (m *Middleware) Optional(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, _ := m.validateSession(r)
		if user != nil {
			ctx := context.WithValue(r.Context(), userContextKey, user)
			r = r.WithContext(ctx)
		}
		next.ServeHTTP(w, r)
	})
}
