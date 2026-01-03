package jobs

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"soar/internal/db"
	"soar/internal/models"
)

type JobHandler func(ctx context.Context, job *models.Job) error

type Runner struct {
	db       *db.DB
	handlers map[models.JobType]JobHandler
	mu       sync.RWMutex
	running  map[string]context.CancelFunc
}

func NewRunner(database *db.DB) *Runner {
	return &Runner{
		db:       database,
		handlers: make(map[models.JobType]JobHandler),
		running:  make(map[string]context.CancelFunc),
	}
}

func (r *Runner) RegisterHandler(jobType models.JobType, handler JobHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[jobType] = handler
}

func (r *Runner) Start(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.processPendingJobs(ctx)
		}
	}
}

func (r *Runner) processPendingJobs(ctx context.Context) {
	jobs, err := r.getPendingJobs()
	if err != nil {
		slog.Error("failed to get pending jobs", "error", err)
		return
	}

	for _, job := range jobs {
		r.mu.RLock()
		_, isRunning := r.running[job.ID]
		r.mu.RUnlock()

		if isRunning {
			continue
		}

		go r.runJob(ctx, job)
	}
}

func (r *Runner) runJob(ctx context.Context, job *models.Job) {
	jobCtx, cancel := context.WithCancel(ctx)
	r.mu.Lock()
	r.running[job.ID] = cancel
	r.mu.Unlock()

	defer func() {
		r.mu.Lock()
		delete(r.running, job.ID)
		r.mu.Unlock()
	}()

	r.updateJobStatus(job.ID, models.JobStatusRunning, 0, "")

	r.mu.RLock()
	handler, exists := r.handlers[job.Type]
	r.mu.RUnlock()

	if !exists {
		slog.Error("no handler for job type", "type", job.Type)
		r.updateJobStatus(job.ID, models.JobStatusFailed, 0, "no handler for job type")
		return
	}

	if err := handler(jobCtx, job); err != nil {
		slog.Error("job failed", "id", job.ID, "error", err)
		r.updateJobStatus(job.ID, models.JobStatusFailed, job.Progress, err.Error())
		return
	}

	r.updateJobStatus(job.ID, models.JobStatusCompleted, 100, "")
}

func (r *Runner) CreateJob(jobType models.JobType, serverID string) (*models.Job, error) {
	id := generateID()
	job := &models.Job{
		ID:        id,
		Type:      jobType,
		ServerID:  serverID,
		Status:    models.JobStatusPending,
		Progress:  0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := r.db.Exec(`
		INSERT INTO jobs (id, type, server_id, status, progress, logs, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, job.ID, job.Type, job.ServerID, job.Status, job.Progress, job.Logs, job.CreatedAt, job.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return job, nil
}

func (r *Runner) GetJob(id string) (*models.Job, error) {
	var job models.Job
	err := r.db.QueryRow(`
		SELECT id, type, server_id, status, progress, logs, created_at, updated_at
		FROM jobs WHERE id = ?
	`, id).Scan(&job.ID, &job.Type, &job.ServerID, &job.Status, &job.Progress, &job.Logs, &job.CreatedAt, &job.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *Runner) UpdateProgress(jobID string, progress float64, logs string) error {
	_, err := r.db.Exec(`
		UPDATE jobs SET progress = ?, logs = logs || ?, updated_at = ?
		WHERE id = ?
	`, progress, logs, time.Now(), jobID)
	return err
}

func (r *Runner) getPendingJobs() ([]*models.Job, error) {
	rows, err := r.db.Query(`
		SELECT id, type, server_id, status, progress, logs, created_at, updated_at
		FROM jobs WHERE status = ? ORDER BY created_at ASC LIMIT 10
	`, models.JobStatusPending)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*models.Job
	for rows.Next() {
		var job models.Job
		if err := rows.Scan(&job.ID, &job.Type, &job.ServerID, &job.Status, &job.Progress, &job.Logs, &job.CreatedAt, &job.UpdatedAt); err != nil {
			return nil, err
		}
		jobs = append(jobs, &job)
	}
	return jobs, rows.Err()
}

func (r *Runner) updateJobStatus(jobID string, status models.JobStatus, progress float64, logs string) {
	_, err := r.db.Exec(`
		UPDATE jobs SET status = ?, progress = ?, logs = ?, updated_at = ?
		WHERE id = ?
	`, status, progress, logs, time.Now(), jobID)
	if err != nil {
		slog.Error("failed to update job status", "id", jobID, "error", err)
	}
}

func (r *Runner) GetServerJobs(serverID string, limit int) ([]*models.Job, error) {
	rows, err := r.db.Query(`
		SELECT id, type, server_id, status, progress, logs, created_at, updated_at
		FROM jobs WHERE server_id = ? ORDER BY created_at DESC LIMIT ?
	`, serverID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*models.Job
	for rows.Next() {
		var job models.Job
		if err := rows.Scan(&job.ID, &job.Type, &job.ServerID, &job.Status, &job.Progress, &job.Logs, &job.CreatedAt, &job.UpdatedAt); err != nil {
			return nil, err
		}
		jobs = append(jobs, &job)
	}
	return jobs, rows.Err()
}

func generateID() string {
	return time.Now().Format("20060102150405") + randomSuffix()
}

func randomSuffix() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = chars[time.Now().UnixNano()%int64(len(chars))]
		time.Sleep(time.Nanosecond)
	}
	return string(b)
}
