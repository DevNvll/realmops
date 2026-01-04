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

	apiServer := api.NewServer(
		cfg,
		database,
		serverManager,
		packLoader,
		jobRunner,
		dockerRuntime,
		rconManager,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go jobRunner.Start(ctx)

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
	apiServer.Shutdown(context.Background())
}
