package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"soar/internal/models"
)

type Provider struct {
	client *client.Client
}

func NewProvider(host string) (*Provider, error) {
	opts := []client.Opt{client.FromEnv, client.WithAPIVersionNegotiation()}
	if host != "" && !strings.HasPrefix(host, "unix://") {
		opts = append(opts, client.WithHost(host))
	}

	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := cli.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to docker: %w", err)
	}

	return &Provider{client: cli}, nil
}

func (p *Provider) Close() error {
	return p.client.Close()
}

type CreateContainerOptions struct {
	Name       string
	Image      string
	Workdir    string
	User       string
	Env        []string
	Command    []string
	Entrypoint []string
	Mounts     []MountConfig
	Ports      []PortMapping
	Labels     map[string]string
}

type MountConfig struct {
	Source string
	Target string
}

type PortMapping struct {
	ContainerPort int
	HostPort      int
	Protocol      string
}

func (p *Provider) CreateContainer(ctx context.Context, opts CreateContainerOptions) (string, error) {
	exposedPorts := nat.PortSet{}
	portBindings := nat.PortMap{}

	for _, pm := range opts.Ports {
		port := nat.Port(fmt.Sprintf("%d/%s", pm.ContainerPort, pm.Protocol))
		exposedPorts[port] = struct{}{}
		portBindings[port] = []nat.PortBinding{
			{
				HostIP:   "0.0.0.0",
				HostPort: fmt.Sprintf("%d", pm.HostPort),
			},
		}
	}

	var mounts []mount.Mount
	for _, m := range opts.Mounts {
		mounts = append(mounts, mount.Mount{
			Type:   mount.TypeBind,
			Source: m.Source,
			Target: m.Target,
		})
	}

	containerConfig := &container.Config{
		Image:        opts.Image,
		WorkingDir:   opts.Workdir,
		User:         opts.User,
		Env:          opts.Env,
		Cmd:          opts.Command,
		Entrypoint:   opts.Entrypoint,
		ExposedPorts: exposedPorts,
		Labels:       opts.Labels,
	}

	hostConfig := &container.HostConfig{
		Mounts:       mounts,
		PortBindings: portBindings,
		RestartPolicy: container.RestartPolicy{
			Name: "no",
		},
	}

	resp, err := p.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, opts.Name)
	if err != nil {
		return "", fmt.Errorf("failed to create container: %w", err)
	}

	return resp.ID, nil
}

func (p *Provider) StartContainer(ctx context.Context, containerID string) error {
	return p.client.ContainerStart(ctx, containerID, types.ContainerStartOptions{})
}

func (p *Provider) StopContainer(ctx context.Context, containerID string, timeout int) error {
	return p.client.ContainerStop(ctx, containerID, container.StopOptions{
		Timeout: &timeout,
	})
}

func (p *Provider) RemoveContainer(ctx context.Context, containerID string, force bool) error {
	return p.client.ContainerRemove(ctx, containerID, types.ContainerRemoveOptions{
		Force:         force,
		RemoveVolumes: true,
	})
}

func (p *Provider) InspectContainer(ctx context.Context, containerID string) (*ContainerInfo, error) {
	info, err := p.client.ContainerInspect(ctx, containerID)
	if err != nil {
		return nil, err
	}

	state := models.ServerStateStopped
	if info.State.Running {
		state = models.ServerStateRunning
	} else if info.State.Restarting {
		state = models.ServerStateStarting
	} else if info.State.ExitCode != 0 {
		state = models.ServerStateError
	}

	return &ContainerInfo{
		ID:       info.ID,
		State:    state,
		ExitCode: info.State.ExitCode,
		Started:  info.State.StartedAt,
		Finished: info.State.FinishedAt,
	}, nil
}

type ContainerInfo struct {
	ID       string
	State    models.ServerState
	ExitCode int
	Started  string
	Finished string
}

type StatsResponse struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs  uint32 `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Limit uint64 `json:"limit"`
	} `json:"memory_stats"`
}

func (p *Provider) GetContainerStats(ctx context.Context, containerID string) (*models.ServerStats, error) {
	stats, err := p.client.ContainerStats(ctx, containerID, false)
	if err != nil {
		return nil, err
	}
	defer stats.Body.Close()

	var statsJSON StatsResponse
	if err := json.NewDecoder(stats.Body).Decode(&statsJSON); err != nil {
		return nil, err
	}

	cpuDelta := float64(statsJSON.CPUStats.CPUUsage.TotalUsage - statsJSON.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(statsJSON.CPUStats.SystemUsage - statsJSON.PreCPUStats.SystemUsage)
	cpuPercent := 0.0
	if systemDelta > 0 && cpuDelta > 0 {
		cpuPercent = (cpuDelta / systemDelta) * float64(statsJSON.CPUStats.OnlineCPUs) * 100.0
	}

	memUsage := int64(statsJSON.MemoryStats.Usage)
	memLimit := int64(statsJSON.MemoryStats.Limit)
	memPercent := 0.0
	if memLimit > 0 {
		memPercent = float64(memUsage) / float64(memLimit) * 100.0
	}

	return &models.ServerStats{
		CPUPercent:    cpuPercent,
		MemoryUsage:   memUsage,
		MemoryLimit:   memLimit,
		MemoryPercent: memPercent,
	}, nil
}

func (p *Provider) GetContainerLogs(ctx context.Context, containerID string, tail string, follow bool) (io.ReadCloser, error) {
	return p.client.ContainerLogs(ctx, containerID, types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     follow,
		Tail:       tail,
		Timestamps: true,
	})
}

func (p *Provider) PullImage(ctx context.Context, imageName string) error {
	reader, err := p.client.ImagePull(ctx, imageName, types.ImagePullOptions{})
	if err != nil {
		return err
	}
	defer reader.Close()
	io.Copy(io.Discard, reader)
	return nil
}

func (p *Provider) ListContainersByLabel(ctx context.Context, labels map[string]string) ([]string, error) {
	filterArgs := filters.NewArgs()
	for k, v := range labels {
		filterArgs.Add("label", fmt.Sprintf("%s=%s", k, v))
	}

	containers, err := p.client.ContainerList(ctx, types.ContainerListOptions{
		All:     true,
		Filters: filterArgs,
	})
	if err != nil {
		return nil, err
	}

	var ids []string
	for _, c := range containers {
		ids = append(ids, c.ID)
	}
	return ids, nil
}
