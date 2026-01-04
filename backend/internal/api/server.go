package api

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"realmops/internal/auth"
	"realmops/internal/config"
	"realmops/internal/db"
	"realmops/internal/docker"
	"realmops/internal/jobs"
	"realmops/internal/packs"
	"realmops/internal/rcon"
	"realmops/internal/server"
	"realmops/internal/sshkeys"
	"realmops/internal/ws"
)

type Server struct {
	cfg               *config.Config
	db                *db.DB
	serverManager     *server.Manager
	packLoader        *packs.Loader
	jobRunner         *jobs.Runner
	logStreamer       *ws.LogStreamer
	consoleHandler    *ws.ConsoleHandler
	authMiddleware    *auth.Middleware
	httpServer        *http.Server
	sshKeyManager     *sshkeys.Manager
	sftpConfigManager *sshkeys.SFTPConfigManager
}

func NewServer(
	cfg *config.Config,
	database *db.DB,
	serverManager *server.Manager,
	packLoader *packs.Loader,
	jobRunner *jobs.Runner,
	dockerProvider *docker.Provider,
	rconManager *rcon.Manager,
	sshKeyManager *sshkeys.Manager,
	sftpConfigManager *sshkeys.SFTPConfigManager,
) *Server {
	return &Server{
		cfg:               cfg,
		db:                database,
		serverManager:     serverManager,
		packLoader:        packLoader,
		jobRunner:         jobRunner,
		logStreamer:       ws.NewLogStreamer(dockerProvider),
		consoleHandler:    ws.NewConsoleHandler(packLoader, rconManager),
		authMiddleware:    auth.NewMiddleware(cfg.AuthServiceURL),
		sshKeyManager:     sshKeyManager,
		sftpConfigManager: sftpConfigManager,
	}
}

func (s *Server) Start() error {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Timeout(60 * time.Second))

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Route("/api", func(r chi.Router) {
		// Health check is public
		r.Get("/health", s.handleHealth)

		// Protected routes require authentication
		r.Group(func(r chi.Router) {
			r.Use(s.authMiddleware.RequireAuth)

			// System info endpoint
			r.Get("/system/info", s.handleSystemInfo)

			r.Route("/servers", func(r chi.Router) {
				r.Get("/", s.handleListServers)
				r.Post("/", s.handleCreateServer)
				r.Get("/{id}", s.handleGetServer)
				r.Delete("/{id}", s.handleDeleteServer)
				r.Post("/{id}/start", s.handleStartServer)
				r.Post("/{id}/stop", s.handleStopServer)
				r.Post("/{id}/restart", s.handleRestartServer)
				r.Get("/{id}/logs", s.handleGetServerLogs)
				r.Get("/{id}/logs/stream", s.handleStreamServerLogs)
				r.Get("/{id}/console", s.handleConsoleWebSocket)
				r.Get("/{id}/jobs", s.handleGetServerJobs)
				r.Get("/{id}/files", s.handleListFiles)
				r.Get("/{id}/files/*", s.handleGetFile)
				r.Put("/{id}/files/*", s.handlePutFile)
				r.Delete("/{id}/files/*", s.handleDeleteFile)
			})

			r.Route("/packs", func(r chi.Router) {
				r.Get("/", s.handleListPacks)
				r.Post("/", s.handleCreatePack)
				r.Post("/import", s.handleImportPack)
				r.Post("/import-path", s.handleImportPackFromPath)
				r.Get("/{id}", s.handleGetPack)
				r.Put("/{id}", s.handleUpdatePack)
				r.Delete("/{id}", s.handleDeletePack)
				r.Get("/{id}/files", s.handleListPackFiles)
				r.Get("/{id}/files/*", s.handleListPackFiles)
				r.Put("/{id}/files/*", s.handleUploadPackFile)
				r.Delete("/{id}/files/*", s.handleDeletePackFile)
			})

			r.Route("/jobs", func(r chi.Router) {
				r.Get("/{id}", s.handleGetJob)
			})

			// SSH Keys management
			r.Route("/ssh-keys", func(r chi.Router) {
				r.Get("/", s.handleListSSHKeys)
				r.Post("/", s.handleCreateSSHKey)
				r.Delete("/{id}", s.handleDeleteSSHKey)
			})

			// Server SFTP configuration
			r.Get("/servers/{id}/sftp", s.handleGetServerSFTP)
			r.Put("/servers/{id}/sftp", s.handleUpdateServerSFTP)
			r.Post("/servers/{id}/sftp/password", s.handleSetServerSFTPPassword)

			// System SFTP status
			r.Get("/system/sftp-status", s.handleGetSFTPStatus)
		})
	})

	s.httpServer = &http.Server{
		Addr:    s.cfg.ListenAddr,
		Handler: r,
	}

	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	if s.httpServer != nil {
		return s.httpServer.Shutdown(ctx)
	}
	return nil
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
