package config

import (
	"os"
	"path/filepath"
	"runtime"
	"strconv"
)

type Config struct {
	ListenAddr     string
	DataDir        string
	DatabasePath   string
	PacksDir       string
	DockerHost     string
	PortRangeStart int
	PortRangeEnd   int
	SessionSecret  string
}

func Load() (*Config, error) {
	defaultDataDir, defaultDockerHost := getPlatformDefaults()

	cfg := &Config{
		ListenAddr:     getEnv("GSM_LISTEN_ADDR", ":8080"),
		DataDir:        getEnv("GSM_DATA_DIR", defaultDataDir),
		PacksDir:       getEnv("GSM_PACKS_DIR", filepath.Join(defaultDataDir, "packs")),
		DockerHost:     getEnv("GSM_DOCKER_HOST", defaultDockerHost),
		PortRangeStart: getEnvInt("GSM_PORT_RANGE_START", 20000),
		PortRangeEnd:   getEnvInt("GSM_PORT_RANGE_END", 40000),
		SessionSecret:  getEnv("GSM_SESSION_SECRET", "change-me-in-production"),
	}

	cfg.DatabasePath = filepath.Join(cfg.DataDir, "db", "gsm.db")

	return cfg, nil
}

func getPlatformDefaults() (dataDir, dockerHost string) {
	if runtime.GOOS == "windows" {
		// Use a local data directory on Windows
		if appData := os.Getenv("LOCALAPPDATA"); appData != "" {
			dataDir = filepath.Join(appData, "gsm")
		} else {
			dataDir = filepath.Join(".", "data")
		}
		dockerHost = "npipe:////./pipe/docker_engine"
	} else {
		dataDir = "/var/lib/gsm"
		dockerHost = "unix:///var/run/docker.sock"
	}
	return
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}
