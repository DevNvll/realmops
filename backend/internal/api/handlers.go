package api

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"realmops/internal/models"
	"realmops/internal/server"
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
