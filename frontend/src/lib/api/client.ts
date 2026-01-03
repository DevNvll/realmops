import type { Server, Job, FileEntry, CreateServerRequest, Manifest } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export const api = {
  servers: {
    list: () => request<Server[]>('/servers'),
    get: (id: string) => request<Server>(`/servers/${id}`),
    create: (data: CreateServerRequest) =>
      request<Server>('/servers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/servers/${id}`, { method: 'DELETE' }),
    start: (id: string) =>
      request<{ status: string }>(`/servers/${id}/start`, { method: 'POST' }),
    stop: (id: string) =>
      request<{ status: string }>(`/servers/${id}/stop`, { method: 'POST' }),
    restart: (id: string) =>
      request<{ status: string }>(`/servers/${id}/restart`, { method: 'POST' }),
    jobs: (id: string) => request<Job[]>(`/servers/${id}/jobs`),
    files: {
      list: (serverId: string, path = '') =>
        request<FileEntry[]>(`/servers/${serverId}/files${path ? `/${path}` : ''}`),
      get: async (serverId: string, path: string) => {
        const res = await fetch(`${API_BASE}/servers/${serverId}/files/${path}`);
        if (!res.ok) throw new Error('Failed to get file');
        return res.text();
      },
      put: async (serverId: string, path: string, content: string) => {
        const res = await fetch(`${API_BASE}/servers/${serverId}/files/${path}`, {
          method: 'PUT',
          body: content,
        });
        if (!res.ok) throw new Error('Failed to save file');
      },
      delete: (serverId: string, path: string) =>
        request<void>(`/servers/${serverId}/files/${path}`, { method: 'DELETE' }),
    },
  },
  packs: {
    list: () => request<Manifest[]>('/packs'),
    get: (id: string) => request<Manifest>(`/packs/${id}`),
    import: async (file: File) => {
      const formData = new FormData();
      formData.append('pack', file);
      const res = await fetch(`${API_BASE}/packs/import`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Import failed' }));
        throw new Error(error.error || 'Import failed');
      }
      return res.json() as Promise<Manifest>;
    },
    importFromPath: (path: string) =>
      request<Manifest>('/packs/import-path', {
        method: 'POST',
        body: JSON.stringify({ path }),
      }),
  },
  jobs: {
    get: (id: string) => request<Job>(`/jobs/${id}`),
  },
};

export function createLogsWebSocket(serverId: string): WebSocket {
  const wsUrl = API_BASE.replace('http', 'ws').replace('/api', '');
  return new WebSocket(`${wsUrl}/api/servers/${serverId}/logs/stream`);
}
