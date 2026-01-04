package models

import (
	"time"
)

type ServerState string

const (
	ServerStateStopped    ServerState = "stopped"
	ServerStateInstalling ServerState = "installing"
	ServerStateStarting   ServerState = "starting"
	ServerStateRunning    ServerState = "running"
	ServerStateStopping   ServerState = "stopping"
	ServerStateError      ServerState = "error"
)

type JobStatus string

const (
	JobStatusPending   JobStatus = "pending"
	JobStatusRunning   JobStatus = "running"
	JobStatusCompleted JobStatus = "completed"
	JobStatusFailed    JobStatus = "failed"
)

type JobType string

const (
	JobTypeInstall  JobType = "install"
	JobTypeUpdate   JobType = "update"
	JobTypeBackup   JobType = "backup"
	JobTypeRestore  JobType = "restore"
	JobTypeModApply JobType = "mod_apply"
)

type GamePack struct {
	ID           string    `json:"id"`
	PackVersion  int       `json:"packVersion"`
	Source       string    `json:"source"`
	Manifest     *Manifest `json:"manifest"`
	ManifestJSON string    `json:"-"`
	InstalledAt  time.Time `json:"installedAt"`
}

type Server struct {
	ID                string            `json:"id"`
	Name              string            `json:"name"`
	PackID            string            `json:"packId"`
	PackVersion       int               `json:"packVersion"`
	Vars              map[string]any    `json:"vars"`
	VarsJSON          string            `json:"-"`
	State             ServerState       `json:"state"`
	DesiredState      ServerState       `json:"desiredState"`
	DockerContainerID string            `json:"dockerContainerId,omitempty"`
	Ports             []ServerPort      `json:"ports"`
	Stats             *ServerStats      `json:"stats,omitempty"`
	CreatedAt         time.Time         `json:"createdAt"`
	UpdatedAt         time.Time         `json:"updatedAt"`
}

type ServerPort struct {
	ServerID      string `json:"serverId"`
	Name          string `json:"name"`
	Protocol      string `json:"protocol"`
	ContainerPort int    `json:"containerPort"`
	HostPort      int    `json:"hostPort"`
}

type ServerStats struct {
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryUsage   int64   `json:"memoryUsage"`
	MemoryLimit   int64   `json:"memoryLimit"`
	MemoryPercent float64 `json:"memoryPercent"`
}

type Job struct {
	ID        string    `json:"id"`
	Type      JobType   `json:"type"`
	ServerID  string    `json:"serverId,omitempty"`
	Status    JobStatus `json:"status"`
	Progress  float64   `json:"progress"`
	Logs      string    `json:"logs"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type ModProfile struct {
	ID        string    `json:"id"`
	ServerID  string    `json:"serverId"`
	Name      string    `json:"name"`
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
}

type ModProfileRevision struct {
	ID        string    `json:"id"`
	ProfileID string    `json:"profileId"`
	Spec      ModSpec   `json:"spec"`
	SpecJSON  string    `json:"-"`
	CreatedAt time.Time `json:"createdAt"`
}

type ModSpec struct {
	Mods []ModEntry `json:"mods"`
}

type ModEntry struct {
	Name       string            `json:"name"`
	SourceType string            `json:"sourceType"` // download-zip, download-file, upload-zip
	SourceURL  string            `json:"sourceUrl,omitempty"`
	FileName   string            `json:"fileName,omitempty"`
	Target     string            `json:"target,omitempty"`
	Overrides  map[string]string `json:"overrides,omitempty"`
}

type Backup struct {
	ID        string    `json:"id"`
	ServerID  string    `json:"serverId"`
	Name      string    `json:"name"`
	SizeBytes int64     `json:"sizeBytes"`
	Path      string    `json:"path"`
	CreatedAt time.Time `json:"createdAt"`
}

type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}
