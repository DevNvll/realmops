export type ServerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface ServerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
}

export interface ServerPort {
  serverId: string;
  name: string;
  protocol: string;
  containerPort: number;
  hostPort: number;
}

export interface Server {
  id: string;
  name: string;
  packId: string;
  packVersion: number;
  vars: Record<string, unknown>;
  state: ServerState;
  desiredState: ServerState;
  dockerContainerId?: string;
  ports: ServerPort[];
  stats?: ServerStats;
  createdAt: string;
  updatedAt: string;
}

export interface VariableConfig {
  name: string;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  default: unknown;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

export interface PortConfig {
  name: string;
  containerPort: number;
  protocol: string;
  hostPortMode: string;
  description: string;
}

export interface Manifest {
  id: string;
  name: string;
  version: string;
  description: string;
  variables: VariableConfig[];
  ports: PortConfig[];
}

export interface GamePack {
  id: string;
  packVersion: number;
  source: string;
  manifest: Manifest;
  installedAt: string;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type JobType = 'install' | 'update' | 'backup' | 'restore' | 'mod_apply';

export interface Job {
  id: string;
  type: JobType;
  serverId?: string;
  status: JobStatus;
  progress: number;
  logs: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileEntry {
  name: string;
  isDir: boolean;
  size: number;
}

export interface CreateServerRequest {
  name: string;
  packId: string;
  variables: Record<string, unknown>;
}
