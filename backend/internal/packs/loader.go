package packs

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
	"soar/internal/models"
)

type Loader struct {
	packsDir string
}

func NewLoader(packsDir string) *Loader {
	return &Loader{packsDir: packsDir}
}

func (l *Loader) PacksDir() string {
	return l.packsDir
}

func (l *Loader) LoadFromDir(packPath string) (*models.Manifest, error) {
	manifestPath := filepath.Join(packPath, "pack.yaml")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read pack.yaml: %w", err)
	}

	var manifest models.Manifest
	if err := yaml.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse pack.yaml: %w", err)
	}

	if err := l.Validate(&manifest); err != nil {
		return nil, fmt.Errorf("pack validation failed: %w", err)
	}

	return &manifest, nil
}

func (l *Loader) ImportFromZip(zipPath string) (*models.Manifest, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open zip: %w", err)
	}
	defer r.Close()

	var manifestFile *zip.File
	var rootPrefix string

	for _, f := range r.File {
		if strings.HasSuffix(f.Name, "pack.yaml") {
			manifestFile = f
			rootPrefix = strings.TrimSuffix(f.Name, "pack.yaml")
			break
		}
	}

	if manifestFile == nil {
		return nil, errors.New("pack.yaml not found in zip")
	}

	rc, err := manifestFile.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	data, err := io.ReadAll(rc)
	if err != nil {
		return nil, err
	}

	var manifest models.Manifest
	if err := yaml.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse pack.yaml: %w", err)
	}

	if err := l.Validate(&manifest); err != nil {
		return nil, fmt.Errorf("pack validation failed: %w", err)
	}

	destDir := filepath.Join(l.packsDir, manifest.ID)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return nil, err
	}

	for _, f := range r.File {
		if !strings.HasPrefix(f.Name, rootPrefix) {
			continue
		}

		relPath := strings.TrimPrefix(f.Name, rootPrefix)
		if relPath == "" {
			continue
		}

		destPath := filepath.Join(destDir, relPath)

		if f.FileInfo().IsDir() {
			os.MkdirAll(destPath, 0755)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return nil, err
		}

		rc, err := f.Open()
		if err != nil {
			return nil, err
		}

		outFile, err := os.Create(destPath)
		if err != nil {
			rc.Close()
			return nil, err
		}

		_, err = io.Copy(outFile, rc)
		rc.Close()
		outFile.Close()
		if err != nil {
			return nil, err
		}
	}

	return &manifest, nil
}

func (l *Loader) ImportFromPath(srcPath string) (*models.Manifest, error) {
	// Load and validate the manifest first
	manifest, err := l.LoadFromDir(srcPath)
	if err != nil {
		return nil, err
	}

	destDir := filepath.Join(l.packsDir, manifest.ID)

	// Remove existing pack if it exists
	os.RemoveAll(destDir)

	// Copy the entire directory
	if err := copyDir(srcPath, destDir); err != nil {
		return nil, fmt.Errorf("failed to copy pack: %w", err)
	}

	return manifest, nil
}

func copyDir(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}

		destPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			return os.MkdirAll(destPath, info.Mode())
		}

		return copyFile(path, destPath)
	})
}

func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}

func (l *Loader) GetPackPath(packID string) string {
	return filepath.Join(l.packsDir, packID)
}

func (l *Loader) ListPacks() ([]*models.Manifest, error) {
	entries, err := os.ReadDir(l.packsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []*models.Manifest{}, nil
		}
		return nil, err
	}

	var packs []*models.Manifest
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		manifest, err := l.LoadFromDir(filepath.Join(l.packsDir, entry.Name()))
		if err != nil {
			continue // skip invalid packs
		}
		packs = append(packs, manifest)
	}

	return packs, nil
}

func (l *Loader) Validate(m *models.Manifest) error {
	var errs []string

	if m.ID == "" {
		errs = append(errs, "id is required")
	}
	if m.Name == "" {
		errs = append(errs, "name is required")
	}
	if m.Runtime.Image == "" {
		errs = append(errs, "runtime.image is required")
	}
	if m.Storage.MountPath == "" {
		errs = append(errs, "storage.mountPath is required")
	}
	if len(m.Ports) == 0 {
		errs = append(errs, "at least one port must be defined")
	}

	for i, port := range m.Ports {
		if port.Name == "" {
			errs = append(errs, fmt.Sprintf("ports[%d].name is required", i))
		}
		if port.ContainerPort <= 0 || port.ContainerPort > 65535 {
			errs = append(errs, fmt.Sprintf("ports[%d].containerPort must be 1-65535", i))
		}
		if port.Protocol != "tcp" && port.Protocol != "udp" {
			errs = append(errs, fmt.Sprintf("ports[%d].protocol must be tcp or udp", i))
		}
	}

	for i, v := range m.Variables {
		if v.Name == "" {
			errs = append(errs, fmt.Sprintf("variables[%d].name is required", i))
		}
		if v.Type == "" {
			errs = append(errs, fmt.Sprintf("variables[%d].type is required", i))
		}
		validTypes := map[string]bool{"string": true, "number": true, "boolean": true, "select": true}
		if !validTypes[v.Type] {
			errs = append(errs, fmt.Sprintf("variables[%d].type must be string, number, boolean, or select", i))
		}
		if v.Type == "select" && len(v.Options) == 0 {
			errs = append(errs, fmt.Sprintf("variables[%d]: select type requires options", i))
		}
	}

	validMethods := map[string]bool{"none": true, "download": true, "steamcmd": true}
	if m.Install.Method != "" && !validMethods[m.Install.Method] {
		errs = append(errs, "install.method must be none, download, or steamcmd")
	}

	if m.Install.Method == "download" && m.Install.URL == "" {
		errs = append(errs, "install.url is required for download method")
	}
	if m.Install.Method == "steamcmd" && m.Install.AppID == 0 {
		errs = append(errs, "install.appId is required for steamcmd method")
	}

	for i, target := range m.Mods.Targets {
		if target.Name == "" {
			errs = append(errs, fmt.Sprintf("mods.targets[%d].name is required", i))
		}
		if target.Path == "" {
			errs = append(errs, fmt.Sprintf("mods.targets[%d].path is required", i))
		}
		validBehaviors := map[string]bool{"merge": true, "clean-then-merge": true, "replace": true}
		if target.Behavior != "" && !validBehaviors[target.Behavior] {
			errs = append(errs, fmt.Sprintf("mods.targets[%d].behavior must be merge, clean-then-merge, or replace", i))
		}
	}

	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}

	return nil
}

func (l *Loader) ManifestToJSON(m *models.Manifest) (string, error) {
	data, err := json.Marshal(m)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (l *Loader) CreatePack(m *models.Manifest) error {
	if err := l.Validate(m); err != nil {
		return fmt.Errorf("pack validation failed: %w", err)
	}

	packDir := filepath.Join(l.packsDir, m.ID)
	if err := os.MkdirAll(packDir, 0755); err != nil {
		return fmt.Errorf("failed to create pack directory: %w", err)
	}

	manifestPath := filepath.Join(packDir, "pack.yaml")
	data, err := yaml.Marshal(m)
	if err != nil {
		return fmt.Errorf("failed to marshal manifest: %w", err)
	}

	if err := os.WriteFile(manifestPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write pack.yaml: %w", err)
	}

	return nil
}

func (l *Loader) UpdatePack(id string, m *models.Manifest) error {
	packDir := filepath.Join(l.packsDir, id)
	if _, err := os.Stat(packDir); os.IsNotExist(err) {
		return fmt.Errorf("pack not found: %s", id)
	}

	if err := l.Validate(m); err != nil {
		return fmt.Errorf("pack validation failed: %w", err)
	}

	// If ID changed, we need to rename the directory
	if m.ID != id {
		newPackDir := filepath.Join(l.packsDir, m.ID)
		if err := os.Rename(packDir, newPackDir); err != nil {
			return fmt.Errorf("failed to rename pack directory: %w", err)
		}
		packDir = newPackDir
	}

	manifestPath := filepath.Join(packDir, "pack.yaml")
	data, err := yaml.Marshal(m)
	if err != nil {
		return fmt.Errorf("failed to marshal manifest: %w", err)
	}

	if err := os.WriteFile(manifestPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write pack.yaml: %w", err)
	}

	return nil
}

func (l *Loader) DeletePack(id string) error {
	packDir := filepath.Join(l.packsDir, id)
	if _, err := os.Stat(packDir); os.IsNotExist(err) {
		return fmt.Errorf("pack not found: %s", id)
	}

	if err := os.RemoveAll(packDir); err != nil {
		return fmt.Errorf("failed to delete pack: %w", err)
	}

	return nil
}
