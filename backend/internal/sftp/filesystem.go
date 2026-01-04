package sftp

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pkg/sftp"
)

// VirtualFS implements a virtual filesystem that maps:
// /data/ -> server data directory (read-write)
// /pack/ -> pack directory (read-only)
type VirtualFS struct {
	serverDataDir string
	packDir       string
	session       *Session
	mu            sync.Mutex
}

// NewVirtualFS creates a new virtual filesystem
func NewVirtualFS(serverDataDir, packDir string, session *Session) *VirtualFS {
	return &VirtualFS{
		serverDataDir: serverDataDir,
		packDir:       packDir,
		session:       session,
	}
}

// Fileread handles file read requests
func (vfs *VirtualFS) Fileread(r *sftp.Request) (io.ReaderAt, error) {
	realPath, readOnly, err := vfs.resolvePath(r.Filepath)
	if err != nil {
		return nil, sftp.ErrSSHFxPermissionDenied
	}
	_ = readOnly // Read operations allowed on both

	file, err := os.Open(realPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, sftp.ErrSSHFxNoSuchFile
		}
		return nil, sftp.ErrSSHFxFailure
	}

	// Track download stats
	if stat, err := file.Stat(); err == nil {
		vfs.session.AddDownload(stat.Size())
	}

	return file, nil
}

// Filewrite handles file write requests
func (vfs *VirtualFS) Filewrite(r *sftp.Request) (io.WriterAt, error) {
	realPath, readOnly, err := vfs.resolvePath(r.Filepath)
	if err != nil {
		return nil, sftp.ErrSSHFxPermissionDenied
	}

	if readOnly {
		return nil, sftp.ErrSSHFxPermissionDenied
	}

	// Ensure parent directory exists
	dir := filepath.Dir(realPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, sftp.ErrSSHFxFailure
	}

	var flags int
	switch r.Method {
	case "Put":
		flags = os.O_WRONLY | os.O_CREATE | os.O_TRUNC
	case "Open":
		flags = os.O_WRONLY | os.O_CREATE
		if r.Pflags().Append {
			flags |= os.O_APPEND
		}
		if r.Pflags().Trunc {
			flags |= os.O_TRUNC
		}
	default:
		return nil, sftp.ErrSSHFxOpUnsupported
	}

	file, err := os.OpenFile(realPath, flags, 0644)
	if err != nil {
		return nil, sftp.ErrSSHFxFailure
	}

	return &writerAtWrapper{file: file, session: vfs.session}, nil
}

// Filecmd handles file commands (mkdir, remove, rename, etc.)
func (vfs *VirtualFS) Filecmd(r *sftp.Request) error {
	realPath, readOnly, err := vfs.resolvePath(r.Filepath)
	if err != nil {
		return sftp.ErrSSHFxPermissionDenied
	}

	if readOnly {
		return sftp.ErrSSHFxPermissionDenied
	}

	switch r.Method {
	case "Setstat":
		return nil // We don't support setstat, but don't error

	case "Rename":
		targetPath, targetReadOnly, err := vfs.resolvePath(r.Target)
		if err != nil || targetReadOnly {
			return sftp.ErrSSHFxPermissionDenied
		}
		return os.Rename(realPath, targetPath)

	case "Rmdir":
		return os.Remove(realPath)

	case "Remove":
		return os.Remove(realPath)

	case "Mkdir":
		return os.MkdirAll(realPath, 0755)

	case "Symlink":
		// Symlinks not supported
		return sftp.ErrSSHFxOpUnsupported

	case "Link":
		// Hard links not supported
		return sftp.ErrSSHFxOpUnsupported
	}

	return sftp.ErrSSHFxOpUnsupported
}

// Filelist handles directory listing and file stat requests
func (vfs *VirtualFS) Filelist(r *sftp.Request) (sftp.ListerAt, error) {
	switch r.Method {
	case "List":
		return vfs.handleList(r.Filepath)

	case "Stat":
		return vfs.handleStat(r.Filepath)

	case "Readlink":
		// Symlinks not supported
		return nil, sftp.ErrSSHFxOpUnsupported
	}

	return nil, sftp.ErrSSHFxOpUnsupported
}

func (vfs *VirtualFS) handleList(path string) (sftp.ListerAt, error) {
	// Handle root directory listing
	if path == "/" || path == "" {
		return &listerat{entries: []os.FileInfo{
			&virtualDirInfo{name: "data"},
			&virtualDirInfo{name: "pack"},
		}}, nil
	}

	realPath, _, err := vfs.resolvePath(path)
	if err != nil {
		return nil, sftp.ErrSSHFxPermissionDenied
	}

	entries, err := os.ReadDir(realPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, sftp.ErrSSHFxNoSuchFile
		}
		return nil, sftp.ErrSSHFxFailure
	}

	var fileInfos []os.FileInfo
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		fileInfos = append(fileInfos, info)
	}

	return &listerat{entries: fileInfos}, nil
}

func (vfs *VirtualFS) handleStat(path string) (sftp.ListerAt, error) {
	// Handle virtual root
	if path == "/" || path == "" {
		return &listerat{entries: []os.FileInfo{
			&virtualDirInfo{name: "/"},
		}}, nil
	}

	// Handle virtual directories
	clean := filepath.Clean("/" + path)
	if clean == "/data" {
		info, err := os.Stat(vfs.serverDataDir)
		if err != nil {
			// Create if doesn't exist
			if os.IsNotExist(err) {
				if err := os.MkdirAll(vfs.serverDataDir, 0755); err != nil {
					return nil, sftp.ErrSSHFxFailure
				}
				return &listerat{entries: []os.FileInfo{
					&virtualDirInfo{name: "data"},
				}}, nil
			}
			return nil, sftp.ErrSSHFxFailure
		}
		return &listerat{entries: []os.FileInfo{
			&renamedFileInfo{FileInfo: info, name: "data"},
		}}, nil
	}

	if clean == "/pack" {
		info, err := os.Stat(vfs.packDir)
		if err != nil {
			if os.IsNotExist(err) {
				return nil, sftp.ErrSSHFxNoSuchFile
			}
			return nil, sftp.ErrSSHFxFailure
		}
		return &listerat{entries: []os.FileInfo{
			&renamedFileInfo{FileInfo: info, name: "pack"},
		}}, nil
	}

	realPath, _, err := vfs.resolvePath(path)
	if err != nil {
		return nil, sftp.ErrSSHFxPermissionDenied
	}

	info, err := os.Stat(realPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, sftp.ErrSSHFxNoSuchFile
		}
		return nil, sftp.ErrSSHFxFailure
	}

	return &listerat{entries: []os.FileInfo{info}}, nil
}

// resolvePath converts a virtual path to a real filesystem path
// Returns the real path, whether it's read-only, and any error
func (vfs *VirtualFS) resolvePath(virtPath string) (realPath string, readOnly bool, err error) {
	// Normalize the path - SFTP uses forward slashes regardless of OS
	// Convert to forward slashes and clean
	clean := "/" + strings.TrimPrefix(virtPath, "/")
	clean = strings.ReplaceAll(clean, "\\", "/")
	// Remove any double slashes and clean
	for strings.Contains(clean, "//") {
		clean = strings.ReplaceAll(clean, "//", "/")
	}
	// Handle .. and .
	parts := []string{}
	for _, part := range strings.Split(clean, "/") {
		if part == ".." {
			if len(parts) > 0 {
				parts = parts[:len(parts)-1]
			}
		} else if part != "." && part != "" {
			parts = append(parts, part)
		}
	}

	if len(parts) < 1 {
		return "", false, errors.New("invalid path")
	}

	// Determine which virtual directory
	switch parts[0] {
	case "data":
		// Data directory is read-write
		subPath := filepath.Join(parts[1:]...)
		realPath = filepath.Join(vfs.serverDataDir, subPath)
		readOnly = false

	case "pack":
		// Pack directory is read-only
		subPath := filepath.Join(parts[1:]...)
		realPath = filepath.Join(vfs.packDir, subPath)
		readOnly = true

	default:
		return "", false, errors.New("invalid virtual directory")
	}

	// Security check: ensure the resolved path is within the base directory
	var baseDir string
	if parts[0] == "data" {
		baseDir = vfs.serverDataDir
	} else {
		baseDir = vfs.packDir
	}

	// Resolve any symlinks and normalize
	absPath, err := filepath.Abs(realPath)
	if err != nil {
		return "", false, err
	}

	absBase, err := filepath.Abs(baseDir)
	if err != nil {
		return "", false, err
	}

	// Check for path traversal (use OS-appropriate separator for comparison)
	// On Windows, paths may have different casing or separators
	absPathNorm := strings.ToLower(filepath.Clean(absPath))
	absBaseNorm := strings.ToLower(filepath.Clean(absBase))

	if !strings.HasPrefix(absPathNorm, absBaseNorm) {
		return "", false, errors.New("path traversal detected")
	}

	return realPath, readOnly, nil
}

// listerat implements sftp.ListerAt
type listerat struct {
	entries []os.FileInfo
}

func (l *listerat) ListAt(ls []os.FileInfo, offset int64) (int, error) {
	if offset >= int64(len(l.entries)) {
		return 0, io.EOF
	}

	n := copy(ls, l.entries[offset:])
	if n < len(ls) {
		return n, io.EOF
	}
	return n, nil
}

// virtualDirInfo represents a virtual directory
type virtualDirInfo struct {
	name string
}

func (v *virtualDirInfo) Name() string       { return v.name }
func (v *virtualDirInfo) Size() int64        { return 0 }
func (v *virtualDirInfo) Mode() os.FileMode  { return os.ModeDir | 0755 }
func (v *virtualDirInfo) ModTime() time.Time { return time.Now() }
func (v *virtualDirInfo) IsDir() bool        { return true }
func (v *virtualDirInfo) Sys() interface{}   { return nil }

// renamedFileInfo wraps a FileInfo with a different name
type renamedFileInfo struct {
	os.FileInfo
	name string
}

func (r *renamedFileInfo) Name() string { return r.name }

// writerAtWrapper wraps a file and tracks upload stats
type writerAtWrapper struct {
	file    *os.File
	session *Session
	written int64
	mu      sync.Mutex
}

func (w *writerAtWrapper) WriteAt(p []byte, off int64) (n int, err error) {
	n, err = w.file.WriteAt(p, off)
	if n > 0 {
		w.mu.Lock()
		w.written += int64(n)
		w.session.AddUpload(int64(n))
		w.mu.Unlock()
	}
	return n, err
}

func (w *writerAtWrapper) Close() error {
	return w.file.Close()
}
