package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"realmops/internal/api"
	"realmops/internal/config"
	"realmops/internal/db"
	"realmops/internal/docker"
	"realmops/internal/jobs"
	"realmops/internal/packs"
	"realmops/internal/ports"
	"realmops/internal/rcon"
	"realmops/internal/server"
	"realmops/internal/sftp"
	"realmops/internal/sshkeys"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Load saved config overrides from config.json
	if err := cfg.LoadSavedConfig(); err != nil {
		slog.Warn("failed to load saved config", "error", err)
	}

	database, err := db.New(cfg.DatabasePath)
	if err != nil {
		slog.Error("failed to initialize database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	if err := database.Migrate(); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	dockerRuntime, err := docker.NewProvider(cfg.DockerHost)
	if err != nil {
		slog.Error("failed to initialize docker provider", "error", err)
		os.Exit(1)
	}
	defer dockerRuntime.Close()

	// Set docker provider for API status endpoint
	api.SetDockerProvider(dockerRuntime)

	packLoader := packs.NewLoader(cfg.PacksDir)

	portAllocator := ports.NewAllocator(database, cfg.PortRangeStart, cfg.PortRangeEnd)

	jobRunner := jobs.NewRunner(database)

	serverManager := server.NewManager(
		database,
		dockerRuntime,
		packLoader,
		portAllocator,
		jobRunner,
		cfg.DataDir,
	)

	rconManager := rcon.NewManager()

	// SSH key and SFTP managers
	sshKeyManager := sshkeys.NewManager(database)
	sftpConfigManager := sshkeys.NewSFTPConfigManager(database)

	apiServer := api.NewServer(
		cfg,
		database,
		serverManager,
		packLoader,
		jobRunner,
		dockerRuntime,
		rconManager,
		sshKeyManager,
		sftpConfigManager,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go jobRunner.Start(ctx)

	// Start SFTP server if enabled
	var sftpServer *sftp.Server
	if cfg.SFTPEnabled {
		var err error
		sftpServer, err = sftp.NewServer(
			cfg,
			database,
			packLoader,
			sshKeyManager,
			sftpConfigManager,
		)
		if err != nil {
			slog.Error("failed to initialize SFTP server", "error", err)
		} else {
			// Set the SFTP server reference for the API status endpoint
			api.SetSFTPServer(sftpServer)

			go func() {
				slog.Info("starting SFTP server", "port", cfg.SFTPPort)
				if err := sftpServer.Start(ctx); err != nil {
					slog.Error("SFTP server error", "error", err)
				}
			}()
		}
	}

	go func() {
		slog.Info("starting API server", "addr", cfg.ListenAddr)
		if err := apiServer.Start(); err != nil {
			slog.Error("API server error", "error", err)
			cancel()
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	slog.Info("shutting down...")
	cancel()
	if sftpServer != nil {
		sftpServer.Shutdown()
	}
	apiServer.Shutdown(context.Background())
}
