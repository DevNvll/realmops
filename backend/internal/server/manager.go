package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"text/template"
	"time"

	"realmops/internal/db"
	"realmops/internal/docker"
	"realmops/internal/jobs"
	"realmops/internal/models"
	"realmops/internal/packs"
	"realmops/internal/ports"
)

type Manager struct {
	db            *db.DB
	docker        *docker.Provider
	packs         *packs.Loader
	ports         *ports.Allocator
	jobs          *jobs.Runner
	dataDir       string
}

func NewManager(
	database *db.DB,
	dockerProvider *docker.Provider,
	packLoader *packs.Loader,
	portAllocator *ports.Allocator,
	jobRunner *jobs.Runner,
	dataDir string,
) *Manager {
	m := &Manager{
		db:      database,
		docker:  dockerProvider,
		packs:   packLoader,
		ports:   portAllocator,
		jobs:    jobRunner,
		dataDir: dataDir,
	}

	jobRunner.RegisterHandler(models.JobTypeInstall, m.handleInstallJob)
	jobRunner.RegisterHandler(models.JobTypeUpdate, m.handleUpdateJob)
	jobRunner.RegisterHandler(models.JobTypeBackup, m.handleBackupJob)
	jobRunner.RegisterHandler(models.JobTypeRestore, m.handleRestoreJob)

	return m
}

type CreateServerRequest struct {
	Name      string         `json:"name"`
	PackID    string         `json:"packId"`
	Variables map[string]any `json:"variables"`
}

func (m *Manager) CreateServer(ctx context.Context, req CreateServerRequest) (*models.Server, error) {
	manifest, err := m.packs.LoadFromDir(m.packs.GetPackPath(req.PackID))
	if err != nil {
		return nil, fmt.Errorf("failed to load pack: %w", err)
	}

	if err := m.validateVariables(manifest, req.Variables); err != nil {
		return nil, fmt.Errorf("invalid variables: %w", err)
	}

	serverID := generateServerID()

	allocatedPorts, err := m.ports.AllocatePorts(serverID, len(manifest.Ports))
	if err != nil {
		return nil, fmt.Errorf("failed to allocate ports: %w", err)
	}

	var serverPorts []models.ServerPort
	for i, portConfig := range manifest.Ports {
		serverPorts = append(serverPorts, models.ServerPort{
			ServerID:      serverID,
			Name:          portConfig.Name,
			Protocol:      portConfig.Protocol,
			ContainerPort: portConfig.ContainerPort,
			HostPort:      allocatedPorts[i],
		})
	}

	varsJSON, _ := json.Marshal(req.Variables)
	server := &models.Server{
		ID:           serverID,
		Name:         req.Name,
		PackID:       req.PackID,
		PackVersion:  1,
		Vars:         req.Variables,
		VarsJSON:     string(varsJSON),
		State:        models.ServerStateStopped,
		DesiredState: models.ServerStateStopped,
		Ports:        serverPorts,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	_, err = m.db.Exec(`
		INSERT INTO servers (id, name, pack_id, pack_version, vars_json, state, desired_state, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, server.ID, server.Name, server.PackID, server.PackVersion, server.VarsJSON, server.State, server.DesiredState, server.CreatedAt, server.UpdatedAt)
	if err != nil {
		m.ports.ReleasePorts(serverID)
		return nil, err
	}

	for _, port := range serverPorts {
		_, err = m.db.Exec(`
			INSERT INTO server_ports (server_id, name, protocol, container_port, host_port)
			VALUES (?, ?, ?, ?, ?)
		`, port.ServerID, port.Name, port.Protocol, port.ContainerPort, port.HostPort)
		if err != nil {
			return nil, err
		}
	}

	if _, err := m.jobs.CreateJob(models.JobTypeInstall, serverID); err != nil {
		return nil, err
	}

	return server, nil
}

func (m *Manager) GetServer(ctx context.Context, id string) (*models.Server, error) {
	var server models.Server
	var dockerContainerID *string

	err := m.db.QueryRow(`
		SELECT id, name, pack_id, pack_version, vars_json, state, desired_state, docker_container_id, created_at, updated_at
		FROM servers WHERE id = ?
	`, id).Scan(&server.ID, &server.Name, &server.PackID, &server.PackVersion, &server.VarsJSON, &server.State, &server.DesiredState, &dockerContainerID, &server.CreatedAt, &server.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if dockerContainerID != nil {
		server.DockerContainerID = *dockerContainerID
	}

	json.Unmarshal([]byte(server.VarsJSON), &server.Vars)

	ports, err := m.getServerPorts(id)
	if err != nil {
		return nil, err
	}
	server.Ports = ports

	if server.DockerContainerID != "" && server.State == models.ServerStateRunning {
		stats, _ := m.docker.GetContainerStats(ctx, server.DockerContainerID)
		server.Stats = stats
	}

	return &server, nil
}

func (m *Manager) ListServers(ctx context.Context) ([]*models.Server, error) {
	rows, err := m.db.Query(`
		SELECT id, name, pack_id, pack_version, vars_json, state, desired_state, docker_container_id, created_at, updated_at
		FROM servers ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []*models.Server
	for rows.Next() {
		var server models.Server
		var dockerContainerID *string
		if err := rows.Scan(&server.ID, &server.Name, &server.PackID, &server.PackVersion, &server.VarsJSON, &server.State, &server.DesiredState, &dockerContainerID, &server.CreatedAt, &server.UpdatedAt); err != nil {
			return nil, err
		}
		if dockerContainerID != nil {
			server.DockerContainerID = *dockerContainerID
		}
		json.Unmarshal([]byte(server.VarsJSON), &server.Vars)

		ports, _ := m.getServerPorts(server.ID)
		server.Ports = ports

		if server.DockerContainerID != "" && server.State == models.ServerStateRunning {
			stats, _ := m.docker.GetContainerStats(ctx, server.DockerContainerID)
			server.Stats = stats
		}

		servers = append(servers, &server)
	}
	return servers, rows.Err()
}

func (m *Manager) StartServer(ctx context.Context, id string) error {
	server, err := m.GetServer(ctx, id)
	if err != nil {
		return err
	}

	if server.State == models.ServerStateInstalling {
		return fmt.Errorf("server is currently installing")
	}

	if server.DockerContainerID == "" {
		return fmt.Errorf("server not installed")
	}

	m.updateServerState(id, models.ServerStateStarting, models.ServerStateRunning)

	if err := m.docker.StartContainer(ctx, server.DockerContainerID); err != nil {
		m.updateServerState(id, models.ServerStateError, models.ServerStateStopped)
		return err
	}

	m.updateServerState(id, models.ServerStateRunning, models.ServerStateRunning)
	return nil
}

func (m *Manager) StopServer(ctx context.Context, id string) error {
	server, err := m.GetServer(ctx, id)
	if err != nil {
		return err
	}

	if server.DockerContainerID == "" {
		return fmt.Errorf("server not installed")
	}

	m.updateServerState(id, models.ServerStateStopping, models.ServerStateStopped)

	manifest, _ := m.packs.LoadFromDir(m.packs.GetPackPath(server.PackID))
	timeout := 30
	if manifest != nil && manifest.Shutdown.Timeout > 0 {
		timeout = manifest.Shutdown.Timeout
	}

	if err := m.docker.StopContainer(ctx, server.DockerContainerID, timeout); err != nil {
		return err
	}

	m.updateServerState(id, models.ServerStateStopped, models.ServerStateStopped)
	return nil
}

func (m *Manager) RestartServer(ctx context.Context, id string) error {
	if err := m.StopServer(ctx, id); err != nil {
		return err
	}
	return m.StartServer(ctx, id)
}

func (m *Manager) DeleteServer(ctx context.Context, id string) error {
	server, err := m.GetServer(ctx, id)
	if err != nil {
		return err
	}

	if server.State == models.ServerStateRunning {
		m.StopServer(ctx, id)
	}

	if server.DockerContainerID != "" {
		m.docker.RemoveContainer(ctx, server.DockerContainerID, true)
	}

	m.ports.ReleasePorts(id)

	serverDataDir := filepath.Join(m.dataDir, "servers", id)
	os.RemoveAll(serverDataDir)

	_, err = m.db.Exec("DELETE FROM servers WHERE id = ?", id)
	return err
}

func (m *Manager) handleInstallJob(ctx context.Context, job *models.Job) error {
	server, err := m.GetServer(ctx, job.ServerID)
	if err != nil {
		return err
	}

	// Set state to installing
	m.updateServerState(server.ID, models.ServerStateInstalling, models.ServerStateStopped)

	manifest, err := m.packs.LoadFromDir(m.packs.GetPackPath(server.PackID))
	if err != nil {
		m.updateServerState(server.ID, models.ServerStateError, models.ServerStateStopped)
		return err
	}

	serverDataDir := filepath.Join(m.dataDir, "servers", server.ID, "data")
	if err := os.MkdirAll(serverDataDir, 0755); err != nil {
		m.updateServerState(server.ID, models.ServerStateError, models.ServerStateStopped)
		return err
	}

	// Handle install step (download, steamcmd, etc.)
	if manifest.Install.Method == "download" {
		m.jobs.UpdateProgress(job.ID, 10, "Downloading server files...\n")
		if err := m.handleDownloadInstall(manifest, server, serverDataDir); err != nil {
			m.updateServerState(server.ID, models.ServerStateError, models.ServerStateStopped)
			return fmt.Errorf("failed to download server files: %w", err)
		}
	}

	m.jobs.UpdateProgress(job.ID, 30, "Rendering configuration...\n")

	if err := m.renderConfigs(manifest, server, serverDataDir); err != nil {
		m.updateServerState(server.ID, models.ServerStateError, models.ServerStateStopped)
		return fmt.Errorf("failed to render configs: %w", err)
	}

	m.jobs.UpdateProgress(job.ID, 40, "Pulling image...\n")

	if err := m.docker.PullImage(ctx, manifest.Runtime.Image); err != nil {
		m.updateServerState(server.ID, models.ServerStateError, models.ServerStateStopped)
		return fmt.Errorf("failed to pull image: %w", err)
	}

	m.jobs.UpdateProgress(job.ID, 60, "Creating container...\n")

	var portMappings []docker.PortMapping
	for _, p := range server.Ports {
		portMappings = append(portMappings, docker.PortMapping{
			ContainerPort: p.ContainerPort,
			HostPort:      p.HostPort,
			Protocol:      p.Protocol,
		})
	}

	var env []string
	for k, v := range manifest.Runtime.Env {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}
	for _, ev := range manifest.Config.EnvVars {
		value := ev.Value
		if ev.Template {
			value = m.renderTemplate(value, server.Vars)
		}
		env = append(env, fmt.Sprintf("%s=%s", ev.Name, value))
	}

	// Render command templates
	var command []string
	for _, arg := range manifest.Start.Command {
		command = append(command, m.renderTemplate(arg, server.Vars))
	}

	containerID, err := m.docker.CreateContainer(ctx, docker.CreateContainerOptions{
		Name:       fmt.Sprintf("gsm-%s", server.ID),
		Image:      manifest.Runtime.Image,
		Workdir:    manifest.Runtime.Workdir,
		User:       manifest.Runtime.User,
		Env:        env,
		Command:    command,
		Entrypoint: manifest.Runtime.Entrypoint,
		Mounts: []docker.MountConfig{
			{
				Source: serverDataDir,
				Target: manifest.Storage.MountPath,
			},
		},
		Ports: portMappings,
		Labels: map[string]string{
			"gsm.server.id":   server.ID,
			"gsm.server.name": server.Name,
			"gsm.pack.id":     server.PackID,
		},
	})
	if err != nil {
		m.updateServerState(server.ID, models.ServerStateError, models.ServerStateStopped)
		return fmt.Errorf("failed to create container: %w", err)
	}

	m.jobs.UpdateProgress(job.ID, 80, "Container created\n")

	_, err = m.db.Exec("UPDATE servers SET docker_container_id = ?, updated_at = ? WHERE id = ?",
		containerID, time.Now(), server.ID)
	if err != nil {
		m.updateServerState(server.ID, models.ServerStateError, models.ServerStateStopped)
		return err
	}

	m.jobs.UpdateProgress(job.ID, 90, "Starting server...\n")

	// Auto-start server after installation
	if err := m.docker.StartContainer(ctx, containerID); err != nil {
		m.updateServerState(server.ID, models.ServerStateError, models.ServerStateStopped)
		return fmt.Errorf("failed to start server after installation: %w", err)
	}

	m.updateServerState(server.ID, models.ServerStateRunning, models.ServerStateRunning)
	m.jobs.UpdateProgress(job.ID, 100, "Installation complete, server started\n")
	return nil
}

func (m *Manager) handleUpdateJob(ctx context.Context, job *models.Job) error {
	return m.handleInstallJob(ctx, job)
}

func (m *Manager) handleBackupJob(ctx context.Context, job *models.Job) error {
	return nil
}

func (m *Manager) handleRestoreJob(ctx context.Context, job *models.Job) error {
	return nil
}

func (m *Manager) handleDownloadInstall(manifest *models.Manifest, server *models.Server, serverDataDir string) error {
	// Render the URL template with server variables
	url := m.renderTemplate(manifest.Install.URL, server.Vars)
	if url == "" {
		return fmt.Errorf("download URL is empty after template rendering")
	}

	// Determine destination path
	dest := manifest.Install.Dest
	if dest == "" {
		return fmt.Errorf("install.dest is required for download method")
	}

	// Convert container path to host path
	// e.g., /data/server.jar -> serverDataDir/server.jar
	destPath := dest
	if strings.HasPrefix(dest, manifest.Storage.MountPath) {
		destPath = strings.TrimPrefix(dest, manifest.Storage.MountPath)
		destPath = strings.TrimPrefix(destPath, "/")
		destPath = filepath.Join(serverDataDir, destPath)
	} else {
		destPath = filepath.Join(serverDataDir, filepath.Base(dest))
	}

	// Ensure parent directory exists
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Download the file
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("failed to download from %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	// Create the destination file
	out, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("failed to create file %s: %w", destPath, err)
	}
	defer out.Close()

	// Copy the response body to the file
	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	return nil
}

func (m *Manager) renderConfigs(manifest *models.Manifest, server *models.Server, dataDir string) error {
	packPath := m.packs.GetPackPath(server.PackID)

	for _, tmpl := range manifest.Config.Templates {
		srcPath := filepath.Join(packPath, "templates", tmpl.Source)
		content, err := os.ReadFile(srcPath)
		if err != nil {
			return fmt.Errorf("failed to read template %s: %w", tmpl.Source, err)
		}

		rendered := m.renderTemplate(string(content), server.Vars)

		destPath := filepath.Join(dataDir, tmpl.Destination)
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return err
		}
		if err := os.WriteFile(destPath, []byte(rendered), 0644); err != nil {
			return err
		}
	}

	return nil
}

func (m *Manager) renderTemplate(tmplStr string, vars map[string]any) string {
	t, err := template.New("").Parse(tmplStr)
	if err != nil {
		return tmplStr
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, vars); err != nil {
		return tmplStr
	}
	return buf.String()
}

func (m *Manager) validateVariables(manifest *models.Manifest, vars map[string]any) error {
	for _, v := range manifest.Variables {
		val, exists := vars[v.Name]
		if v.Required && !exists {
			return fmt.Errorf("missing required variable: %s", v.Name)
		}
		if !exists {
			continue
		}

		switch v.Type {
		case "string":
			if _, ok := val.(string); !ok {
				return fmt.Errorf("variable %s must be a string", v.Name)
			}
		case "number":
			switch val.(type) {
			case int, int64, float64:
			default:
				return fmt.Errorf("variable %s must be a number", v.Name)
			}
		case "boolean":
			if _, ok := val.(bool); !ok {
				return fmt.Errorf("variable %s must be a boolean", v.Name)
			}
		case "select":
			strVal, ok := val.(string)
			if !ok {
				return fmt.Errorf("variable %s must be a string", v.Name)
			}
			valid := false
			for _, opt := range v.Options {
				if opt == strVal {
					valid = true
					break
				}
			}
			if !valid {
				return fmt.Errorf("variable %s has invalid value", v.Name)
			}
		}
	}
	return nil
}

func (m *Manager) getServerPorts(serverID string) ([]models.ServerPort, error) {
	rows, err := m.db.Query(`
		SELECT server_id, name, protocol, container_port, host_port
		FROM server_ports WHERE server_id = ?
	`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ports []models.ServerPort
	for rows.Next() {
		var p models.ServerPort
		if err := rows.Scan(&p.ServerID, &p.Name, &p.Protocol, &p.ContainerPort, &p.HostPort); err != nil {
			return nil, err
		}
		ports = append(ports, p)
	}
	return ports, rows.Err()
}

func (m *Manager) updateServerState(id string, state, desiredState models.ServerState) {
	m.db.Exec("UPDATE servers SET state = ?, desired_state = ?, updated_at = ? WHERE id = ?",
		state, desiredState, time.Now(), id)
}

func (m *Manager) GetDataDir() string {
	return m.dataDir
}

func generateServerID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
