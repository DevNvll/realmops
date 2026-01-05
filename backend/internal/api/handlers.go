package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"realmops/internal/models"
	"realmops/internal/server"
	"realmops/internal/sshkeys"

	"github.com/go-chi/chi/v5"
)

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func (s *Server) handleListServers(w http.ResponseWriter, r *http.Request) {
	servers, err := s.serverManager.ListServers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, servers)
}

func (s *Server) handleCreateServer(w http.ResponseWriter, r *http.Request) {
	var req server.CreateServerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	srv, err := s.serverManager.CreateServer(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, srv)
}

func (s *Server) handleGetServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	srv, err := s.serverManager.GetServer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "server not found")
		return
	}
	writeJSON(w, http.StatusOK, srv)
}

func (s *Server) handleDeleteServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.serverManager.DeleteServer(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleUpdateServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req server.UpdateServerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	srv, err := s.serverManager.UpdateServer(r.Context(), id, req)
	if err != nil {
		if strings.Contains(err.Error(), "cannot update") {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, srv)
}

func (s *Server) handleStartServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.serverManager.StartServer(r.Context(), id); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "started"})
}

func (s *Server) handleStopServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.serverManager.StopServer(r.Context(), id); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "stopped"})
}

func (s *Server) handleRestartServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.serverManager.RestartServer(r.Context(), id); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "restarted"})
}

func (s *Server) handleGetServerLogs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	srv, err := s.serverManager.GetServer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "server not found")
		return
	}

	if srv.DockerContainerID == "" {
		writeError(w, http.StatusBadRequest, "server not installed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"containerId": srv.DockerContainerID})
}

func (s *Server) handleStreamServerLogs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	srv, err := s.serverManager.GetServer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "server not found")
		return
	}

	if srv.DockerContainerID == "" {
		writeError(w, http.StatusBadRequest, "server not installed")
		return
	}

	s.logStreamer.HandleWebSocket(w, r, srv.DockerContainerID)
}

func (s *Server) handleConsoleWebSocket(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	srv, err := s.serverManager.GetServer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "server not found")
		return
	}

	if srv.State != "running" {
		writeError(w, http.StatusBadRequest, "server must be running to use console")
		return
	}

	s.consoleHandler.HandleWebSocket(w, r, srv)
}

func (s *Server) handleGetServerJobs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	jobs, err := s.jobRunner.GetServerJobs(id, 20)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, jobs)
}

func (s *Server) handleListPacks(w http.ResponseWriter, r *http.Request) {
	packs, err := s.packLoader.ListPacks()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, packs)
}

func (s *Server) handleCreatePack(w http.ResponseWriter, r *http.Request) {
	var manifest models.Manifest
	if err := json.NewDecoder(r.Body).Decode(&manifest); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := s.packLoader.CreatePack(&manifest); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	manifestJSON, _ := s.packLoader.ManifestToJSON(&manifest)
	_, err := s.db.Exec(`
		INSERT OR REPLACE INTO game_packs (id, pack_version, source, manifest_json)
		VALUES (?, 1, ?, ?)
	`, manifest.ID, "created", manifestJSON)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, manifest)
}

func (s *Server) handleImportPack(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "failed to parse form")
		return
	}

	file, header, err := r.FormFile("pack")
	if err != nil {
		writeError(w, http.StatusBadRequest, "no pack file provided")
		return
	}
	defer file.Close()

	tempFile, err := os.CreateTemp("", "pack-*.zip")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create temp file")
		return
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	if _, err := io.Copy(tempFile, file); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save file")
		return
	}
	tempFile.Close()

	manifest, err := s.packLoader.ImportFromZip(tempFile.Name())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	manifestJSON, _ := s.packLoader.ManifestToJSON(manifest)
	_, err = s.db.Exec(`
		INSERT OR REPLACE INTO game_packs (id, pack_version, source, manifest_json)
		VALUES (?, 1, ?, ?)
	`, manifest.ID, header.Filename, manifestJSON)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, manifest)
}

func (s *Server) handleImportPackFromPath(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Path == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}

	// Verify path exists and is a directory
	info, err := os.Stat(req.Path)
	if err != nil {
		writeError(w, http.StatusBadRequest, "path does not exist")
		return
	}
	if !info.IsDir() {
		writeError(w, http.StatusBadRequest, "path is not a directory")
		return
	}

	manifest, err := s.packLoader.ImportFromPath(req.Path)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	manifestJSON, _ := s.packLoader.ManifestToJSON(manifest)
	_, err = s.db.Exec(`
		INSERT OR REPLACE INTO game_packs (id, pack_version, source, manifest_json)
		VALUES (?, 1, ?, ?)
	`, manifest.ID, req.Path, manifestJSON)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, manifest)
}

func (s *Server) handleGetPack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	manifest, err := s.packLoader.LoadFromDir(s.packLoader.GetPackPath(id))
	if err != nil {
		writeError(w, http.StatusNotFound, "pack not found")
		return
	}
	writeJSON(w, http.StatusOK, manifest)
}

func (s *Server) handleUpdatePack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var manifest models.Manifest
	if err := json.NewDecoder(r.Body).Decode(&manifest); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := s.packLoader.UpdatePack(id, &manifest); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Update database record
	manifestJSON, _ := s.packLoader.ManifestToJSON(&manifest)
	_, err := s.db.Exec(`
		UPDATE game_packs SET id = ?, manifest_json = ? WHERE id = ?
	`, manifest.ID, manifestJSON, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, manifest)
}

func (s *Server) handleDeletePack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := s.packLoader.DeletePack(id); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Delete from database
	_, err := s.db.Exec(`DELETE FROM game_packs WHERE id = ?`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleListPackFiles(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	packDir := s.packLoader.GetPackPath(id)

	if _, err := os.Stat(packDir); os.IsNotExist(err) {
		writeError(w, http.StatusNotFound, "pack not found")
		return
	}

	filePath := chi.URLParam(r, "*")
	targetDir := packDir
	if filePath != "" {
		targetDir = filepath.Join(packDir, filePath)
	}

	// Security check
	if !strings.HasPrefix(targetDir, packDir) {
		writeError(w, http.StatusForbidden, "access denied")
		return
	}

	info, err := os.Stat(targetDir)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusOK, []any{})
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if !info.IsDir() {
		// Return file content
		content, err := os.ReadFile(targetDir)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Write(content)
		return
	}

	entries, err := os.ReadDir(targetDir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	files := make([]map[string]any, 0)
	for _, entry := range entries {
		entryInfo, _ := entry.Info()
		files = append(files, map[string]any{
			"name":  entry.Name(),
			"isDir": entry.IsDir(),
			"size":  entryInfo.Size(),
		})
	}
	writeJSON(w, http.StatusOK, files)
}

func (s *Server) handleUploadPackFile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	packDir := s.packLoader.GetPackPath(id)

	if _, err := os.Stat(packDir); os.IsNotExist(err) {
		writeError(w, http.StatusNotFound, "pack not found")
		return
	}

	filePath := chi.URLParam(r, "*")
	if filePath == "" {
		writeError(w, http.StatusBadRequest, "file path required")
		return
	}

	fullPath := filepath.Join(packDir, filePath)

	// Security check
	if !strings.HasPrefix(fullPath, packDir) {
		writeError(w, http.StatusForbidden, "access denied")
		return
	}

	// Prevent overwriting pack.yaml via this endpoint
	if filepath.Base(fullPath) == "pack.yaml" {
		writeError(w, http.StatusForbidden, "cannot modify pack.yaml via file upload")
		return
	}

	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	content, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}

	if err := os.WriteFile(fullPath, content, 0644); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleDeletePackFile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	packDir := s.packLoader.GetPackPath(id)

	if _, err := os.Stat(packDir); os.IsNotExist(err) {
		writeError(w, http.StatusNotFound, "pack not found")
		return
	}

	filePath := chi.URLParam(r, "*")
	if filePath == "" {
		writeError(w, http.StatusBadRequest, "file path required")
		return
	}

	fullPath := filepath.Join(packDir, filePath)

	// Security check
	if !strings.HasPrefix(fullPath, packDir) {
		writeError(w, http.StatusForbidden, "access denied")
		return
	}

	// Prevent deleting pack.yaml
	if filepath.Base(fullPath) == "pack.yaml" {
		writeError(w, http.StatusForbidden, "cannot delete pack.yaml")
		return
	}

	if err := os.RemoveAll(fullPath); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleGetJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	job, err := s.jobRunner.GetJob(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (s *Server) handleListFiles(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	srv, err := s.serverManager.GetServer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "server not found")
		return
	}

	dataDir := filepath.Join(s.serverManager.GetDataDir(), "servers", srv.ID, "data")
	entries, err := os.ReadDir(dataDir)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusOK, []any{})
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var files []map[string]any
	for _, entry := range entries {
		info, _ := entry.Info()
		files = append(files, map[string]any{
			"name":  entry.Name(),
			"isDir": entry.IsDir(),
			"size":  info.Size(),
		})
	}
	writeJSON(w, http.StatusOK, files)
}

func (s *Server) handleGetFile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	srv, err := s.serverManager.GetServer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "server not found")
		return
	}

	filePath := chi.URLParam(r, "*")
	fullPath := filepath.Join(s.serverManager.GetDataDir(), "servers", srv.ID, "data", filePath)

	if !strings.HasPrefix(fullPath, filepath.Join(s.serverManager.GetDataDir(), "servers", srv.ID, "data")) {
		writeError(w, http.StatusForbidden, "access denied")
		return
	}

	info, err := os.Stat(fullPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}

	if info.IsDir() {
		entries, err := os.ReadDir(fullPath)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		var files []map[string]any
		for _, entry := range entries {
			entryInfo, _ := entry.Info()
			files = append(files, map[string]any{
				"name":  entry.Name(),
				"isDir": entry.IsDir(),
				"size":  entryInfo.Size(),
			})
		}
		writeJSON(w, http.StatusOK, files)
		return
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(content)
}

func (s *Server) handlePutFile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	srv, err := s.serverManager.GetServer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "server not found")
		return
	}

	filePath := chi.URLParam(r, "*")
	fullPath := filepath.Join(s.serverManager.GetDataDir(), "servers", srv.ID, "data", filePath)

	if !strings.HasPrefix(fullPath, filepath.Join(s.serverManager.GetDataDir(), "servers", srv.ID, "data")) {
		writeError(w, http.StatusForbidden, "access denied")
		return
	}

	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	content, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}

	if err := os.WriteFile(fullPath, content, 0644); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleDeleteFile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	srv, err := s.serverManager.GetServer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "server not found")
		return
	}

	filePath := chi.URLParam(r, "*")
	fullPath := filepath.Join(s.serverManager.GetDataDir(), "servers", srv.ID, "data", filePath)

	if !strings.HasPrefix(fullPath, filepath.Join(s.serverManager.GetDataDir(), "servers", srv.ID, "data")) {
		writeError(w, http.StatusForbidden, "access denied")
		return
	}

	if err := os.RemoveAll(fullPath); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleSystemInfo(w http.ResponseWriter, r *http.Request) {
	hostIP := getOutboundIP()
	writeJSON(w, http.StatusOK, map[string]string{
		"hostIP": hostIP,
	})
}

// getOutboundIP gets the preferred outbound IP of this machine
func getOutboundIP() string {
	// Try to get the IP by dialing a public address (doesn't actually connect)
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		// Fallback: try to find a non-loopback interface
		return getFirstNonLoopbackIP()
	}
	defer conn.Close()

	localAddr := conn.LocalAddr().(*net.UDPAddr)
	return localAddr.IP.String()
}

func getFirstNonLoopbackIP() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "localhost"
	}

	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}

			if ip == nil || ip.IsLoopback() {
				continue
			}

			// Prefer IPv4
			if ip4 := ip.To4(); ip4 != nil {
				return ip4.String()
			}
		}
	}

	return "localhost"
}

// SSH Key handlers

func (s *Server) handleListSSHKeys(w http.ResponseWriter, r *http.Request) {
	keys, err := s.sshKeyManager.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Return empty array instead of null
	if keys == nil {
		keys = []*sshkeys.SSHKey{}
	}

	writeJSON(w, http.StatusOK, keys)
}

func (s *Server) handleCreateSSHKey(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name      string `json:"name"`
		PublicKey string `json:"publicKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.PublicKey == "" {
		writeError(w, http.StatusBadRequest, "publicKey is required")
		return
	}

	// Generate ID
	id := fmt.Sprintf("key_%d", time.Now().UnixNano())

	key, err := s.sshKeyManager.Create(id, req.Name, req.PublicKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, key)
}

func (s *Server) handleDeleteSSHKey(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.sshKeyManager.Delete(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Server SFTP config handlers

type SFTPConfigResponse struct {
	Enabled        bool                        `json:"enabled"`
	SSHKeyID       *string                     `json:"sshKeyId,omitempty"`
	SSHKeyName     *string                     `json:"sshKeyName,omitempty"`
	Username       string                      `json:"username"`
	HasPassword    bool                        `json:"hasPassword"`
	ConnectionInfo SFTPConnectionInfoResponse  `json:"connectionInfo"`
}

type SFTPConnectionInfoResponse struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
}

func (s *Server) handleGetServerSFTP(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Verify server exists
	_, err := s.serverManager.GetServer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "server not found")
		return
	}

	// Get or create SFTP config
	config, err := s.sftpConfigManager.GetOrCreate(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Parse port from config
	port := 2022
	if s.cfg.SFTPPort != "" {
		portStr := strings.TrimPrefix(s.cfg.SFTPPort, ":")
		fmt.Sscanf(portStr, "%d", &port)
	}

	response := SFTPConfigResponse{
		Enabled:     config.Enabled,
		SSHKeyID:    config.SSHKeyID,
		SSHKeyName:  config.SSHKeyName,
		Username:    config.SFTPUsername,
		HasPassword: config.HasPassword,
		ConnectionInfo: SFTPConnectionInfoResponse{
			Host:     getOutboundIP(),
			Port:     port,
			Username: config.SFTPUsername,
		},
	}

	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleUpdateServerSFTP(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Verify server exists
	_, err := s.serverManager.GetServer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "server not found")
		return
	}

	var req struct {
		Enabled  *bool   `json:"enabled"`
		SSHKeyID *string `json:"sshKeyId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Get existing config or create one
	config, err := s.sftpConfigManager.GetOrCreate(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Apply updates
	enabled := config.Enabled
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	sshKeyID := config.SSHKeyID
	if req.SSHKeyID != nil {
		if *req.SSHKeyID == "" {
			sshKeyID = nil
		} else {
			// Verify the key exists
			_, err := s.sshKeyManager.Get(*req.SSHKeyID)
			if err != nil {
				writeError(w, http.StatusBadRequest, "SSH key not found")
				return
			}
			sshKeyID = req.SSHKeyID
		}
	}

	if err := s.sftpConfigManager.Update(id, enabled, sshKeyID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Return updated config
	s.handleGetServerSFTP(w, r)
}

func (s *Server) handleSetServerSFTPPassword(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Verify server exists
	_, err := s.serverManager.GetServer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "server not found")
		return
	}

	// Get or create SFTP config
	_, err = s.sftpConfigManager.GetOrCreate(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Generate a secure random password
	passwordBytes := make([]byte, 24)
	if _, err := rand.Read(passwordBytes); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate password")
		return
	}
	password := base64.URLEncoding.EncodeToString(passwordBytes)[:24]

	// Set the password
	if err := s.sftpConfigManager.SetPassword(id, password); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"password": password,
	})
}

// SFTP Server status handler
// Note: sftpServer reference will be set by main.go

var sftpServerInstance SFTPServerInterface

type SFTPServerInterface interface {
	GetHostFingerprint() string
	GetActiveSessions() int
}

func SetSFTPServer(server SFTPServerInterface) {
	sftpServerInstance = server
}

func (s *Server) handleGetSFTPStatus(w http.ResponseWriter, r *http.Request) {
	// Parse port from config
	port := 2022
	if s.cfg.SFTPPort != "" {
		portStr := strings.TrimPrefix(s.cfg.SFTPPort, ":")
		fmt.Sscanf(portStr, "%d", &port)
	}

	response := map[string]any{
		"running": s.cfg.SFTPEnabled && sftpServerInstance != nil,
		"enabled": s.cfg.SFTPEnabled,
		"port":    port,
	}

	if sftpServerInstance != nil {
		response["hostFingerprint"] = sftpServerInstance.GetHostFingerprint()
		response["activeSessions"] = sftpServerInstance.GetActiveSessions()
	}

	writeJSON(w, http.StatusOK, response)
}

// System config handlers

type SystemConfigResponse struct {
	// Running configuration (read-only)
	Running struct {
		SFTPEnabled    bool   `json:"sftpEnabled"`
		SFTPPort       int    `json:"sftpPort"`
		PortRangeStart int    `json:"portRangeStart"`
		PortRangeEnd   int    `json:"portRangeEnd"`
		DockerHost     string `json:"dockerHost"`
		DataDir        string `json:"dataDir"`
		DatabasePath   string `json:"databasePath"`
		PacksDir       string `json:"packsDir"`
	} `json:"running"`

	// Saved configuration (can differ from running if restart needed)
	Saved struct {
		SFTPEnabled    *bool   `json:"sftpEnabled,omitempty"`
		SFTPPort       *string `json:"sftpPort,omitempty"`
		PortRangeStart *int    `json:"portRangeStart,omitempty"`
		PortRangeEnd   *int    `json:"portRangeEnd,omitempty"`
		DockerHost     *string `json:"dockerHost,omitempty"`
	} `json:"saved"`

	// Status info
	PendingRestart bool `json:"pendingRestart"`
	DockerConnected bool `json:"dockerConnected"`
}

func (s *Server) handleGetSystemConfig(w http.ResponseWriter, r *http.Request) {
	// Parse port from config
	port := 2022
	if s.cfg.SFTPPort != "" {
		portStr := strings.TrimPrefix(s.cfg.SFTPPort, ":")
		fmt.Sscanf(portStr, "%d", &port)
	}

	response := SystemConfigResponse{
		PendingRestart: s.cfg.HasPendingChanges(),
		DockerConnected: dockerProviderInstance != nil && dockerProviderInstance.IsConnected(),
	}

	// Running config
	response.Running.SFTPEnabled = s.cfg.SFTPEnabled
	response.Running.SFTPPort = port
	response.Running.PortRangeStart = s.cfg.PortRangeStart
	response.Running.PortRangeEnd = s.cfg.PortRangeEnd
	response.Running.DockerHost = s.cfg.DockerHost
	response.Running.DataDir = s.cfg.DataDir
	response.Running.DatabasePath = s.cfg.DatabasePath
	response.Running.PacksDir = s.cfg.PacksDir

	// Saved config
	saved := s.cfg.GetSavedConfig()
	response.Saved.SFTPEnabled = saved.SFTPEnabled
	response.Saved.SFTPPort = saved.SFTPPort
	response.Saved.PortRangeStart = saved.PortRangeStart
	response.Saved.PortRangeEnd = saved.PortRangeEnd
	response.Saved.DockerHost = saved.DockerHost

	writeJSON(w, http.StatusOK, response)
}

type UpdateConfigRequest struct {
	SFTPEnabled    *bool   `json:"sftpEnabled,omitempty"`
	SFTPPort       *int    `json:"sftpPort,omitempty"`
	PortRangeStart *int    `json:"portRangeStart,omitempty"`
	PortRangeEnd   *int    `json:"portRangeEnd,omitempty"`
	DockerHost     *string `json:"dockerHost,omitempty"`
}

func (s *Server) handleUpdateSystemConfig(w http.ResponseWriter, r *http.Request) {
	var req UpdateConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Get current saved config and merge updates
	saved := s.cfg.GetSavedConfig()

	if req.SFTPEnabled != nil {
		saved.SFTPEnabled = req.SFTPEnabled
	}
	if req.SFTPPort != nil {
		portStr := fmt.Sprintf(":%d", *req.SFTPPort)
		saved.SFTPPort = &portStr
	}
	if req.PortRangeStart != nil {
		saved.PortRangeStart = req.PortRangeStart
	}
	if req.PortRangeEnd != nil {
		saved.PortRangeEnd = req.PortRangeEnd
	}
	if req.DockerHost != nil {
		saved.DockerHost = req.DockerHost
	}

	// Validate port range
	start := s.cfg.PortRangeStart
	end := s.cfg.PortRangeEnd
	if saved.PortRangeStart != nil {
		start = *saved.PortRangeStart
	}
	if saved.PortRangeEnd != nil {
		end = *saved.PortRangeEnd
	}
	if start >= end {
		writeError(w, http.StatusBadRequest, "port range start must be less than end")
		return
	}
	if start < 1024 || end > 65535 {
		writeError(w, http.StatusBadRequest, "port range must be between 1024 and 65535")
		return
	}

	// Save to file
	if err := s.cfg.SaveConfig(saved); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save config: "+err.Error())
		return
	}

	// Return updated config
	s.handleGetSystemConfig(w, r)
}

// Docker provider interface for checking connection status
var dockerProviderInstance DockerProviderInterface

type DockerProviderInterface interface {
	IsConnected() bool
}

func SetDockerProvider(provider DockerProviderInterface) {
	dockerProviderInstance = provider
}
