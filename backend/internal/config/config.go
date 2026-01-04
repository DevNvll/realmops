package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"sync"
)

type Config struct {
	ListenAddr      string
	DataDir         string
	DatabasePath    string
	PacksDir        string
	DockerHost      string
	PortRangeStart  int
	PortRangeEnd    int
	SessionSecret   string
	AuthServiceURL  string
	SFTPEnabled     bool
	SFTPPort        string
	SFTPHostKeyPath string

	// mu protects savedConfig
	mu          sync.RWMutex
	savedConfig *SavedConfig
}

// SavedConfig represents user-configurable settings persisted to disk
type SavedConfig struct {
	SFTPEnabled    *bool   `json:"sftpEnabled,omitempty"`
	SFTPPort       *string `json:"sftpPort,omitempty"`
	PortRangeStart *int    `json:"portRangeStart,omitempty"`
	PortRangeEnd   *int    `json:"portRangeEnd,omitempty"`
	DockerHost     *string `json:"dockerHost,omitempty"`
}

func Load() (*Config, error) {
	defaultDataDir, defaultDockerHost := getPlatformDefaults()
	defaultPacksDir := getDefaultPacksDir(defaultDataDir)

	cfg := &Config{
		ListenAddr:     getEnv("GSM_LISTEN_ADDR", ":8080"),
		DataDir:        getEnv("GSM_DATA_DIR", defaultDataDir),
		PacksDir:       getEnv("GSM_PACKS_DIR", defaultPacksDir),
		DockerHost:     getEnv("GSM_DOCKER_HOST", defaultDockerHost),
		PortRangeStart: getEnvInt("GSM_PORT_RANGE_START", 20000),
		PortRangeEnd:   getEnvInt("GSM_PORT_RANGE_END", 40000),
		SessionSecret:  getEnv("GSM_SESSION_SECRET", "change-me-in-production"),
		AuthServiceURL: getEnv("GSM_AUTH_SERVICE_URL", "http://localhost:3001"),
		SFTPEnabled:    getEnvBool("GSM_SFTP_ENABLED", true),
		SFTPPort:       getEnv("GSM_SFTP_PORT", ":2022"),
	}

	cfg.DatabasePath = filepath.Join(cfg.DataDir, "db", "gsm.db")
	cfg.SFTPHostKeyPath = getEnv("GSM_SFTP_HOST_KEY_PATH", filepath.Join(cfg.DataDir, "sftp_host_key"))

	return cfg, nil
}

func getDefaultPacksDir(defaultDataDir string) string {
	// In development, prefer local ./packs directory if it exists
	if info, err := os.Stat("./packs"); err == nil && info.IsDir() {
		if abs, err := filepath.Abs("./packs"); err == nil {
			return abs
		}
	}
	return filepath.Join(defaultDataDir, "packs")
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

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if b, err := strconv.ParseBool(value); err == nil {
			return b
		}
	}
	return defaultValue
}

// GetConfigFilePath returns the path to the config.json file
func (c *Config) GetConfigFilePath() string {
	return filepath.Join(c.DataDir, "config.json")
}

// LoadSavedConfig loads user-configured settings from config.json
func (c *Config) LoadSavedConfig() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	configPath := c.GetConfigFilePath()
	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			c.savedConfig = &SavedConfig{}
			return nil
		}
		return err
	}

	var saved SavedConfig
	if err := json.Unmarshal(data, &saved); err != nil {
		return err
	}

	c.savedConfig = &saved

	// Apply saved config overrides
	if saved.SFTPEnabled != nil {
		c.SFTPEnabled = *saved.SFTPEnabled
	}
	if saved.SFTPPort != nil {
		c.SFTPPort = *saved.SFTPPort
	}
	if saved.PortRangeStart != nil {
		c.PortRangeStart = *saved.PortRangeStart
	}
	if saved.PortRangeEnd != nil {
		c.PortRangeEnd = *saved.PortRangeEnd
	}
	if saved.DockerHost != nil {
		c.DockerHost = *saved.DockerHost
	}

	return nil
}

// SaveConfig saves user-configured settings to config.json
func (c *Config) SaveConfig(saved *SavedConfig) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	configPath := c.GetConfigFilePath()

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(saved, "", "  ")
	if err != nil {
		return err
	}

	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return err
	}

	c.savedConfig = saved
	return nil
}

// GetSavedConfig returns the current saved config
func (c *Config) GetSavedConfig() *SavedConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.savedConfig == nil {
		return &SavedConfig{}
	}
	return c.savedConfig
}

// HasPendingChanges checks if saved config differs from running config
func (c *Config) HasPendingChanges() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.savedConfig == nil {
		return false
	}

	// Compare saved values to running values
	if c.savedConfig.SFTPEnabled != nil && *c.savedConfig.SFTPEnabled != c.SFTPEnabled {
		return true
	}
	if c.savedConfig.SFTPPort != nil && *c.savedConfig.SFTPPort != c.SFTPPort {
		return true
	}
	if c.savedConfig.PortRangeStart != nil && *c.savedConfig.PortRangeStart != c.PortRangeStart {
		return true
	}
	if c.savedConfig.PortRangeEnd != nil && *c.savedConfig.PortRangeEnd != c.PortRangeEnd {
		return true
	}
	if c.savedConfig.DockerHost != nil && *c.savedConfig.DockerHost != c.DockerHost {
		return true
	}

	return false
}
