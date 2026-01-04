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

export interface RCONConfig {
  enabled: boolean;
  portName: string;
  passwordVariable: string;
}

export interface RuntimeConfig {
  image: string;
  workdir?: string;
  user?: string;
  env?: Record<string, string>;
  entrypoint?: string[];
}

export interface StorageConfig {
  mountPath: string;
}

export interface InstallConfig {
  method: 'none' | 'download' | 'steamcmd';
  url?: string;
  dest?: string;
  checksum?: string;
  appId?: number;
  branch?: string;
}

export interface TemplateConfig {
  source: string;
  destination: string;
}

export interface EnvVarConfig {
  name: string;
  value: string;
  template?: boolean;
}

export interface ConfigRendering {
  templates?: TemplateConfig[];
  envVars?: EnvVarConfig[];
}

export interface StartConfig {
  command: string[];
}

export interface HealthConfig {
  type?: 'tcp' | 'udp' | 'process' | 'http';
  port?: number;
  path?: string;
  gracePeriod?: number;
  interval?: number;
  timeout?: number;
  retries?: number;
}

export interface ShutdownConfig {
  signal?: string;
  timeout?: number;
}

export interface ModTarget {
  name: string;
  path: string;
  behavior?: 'merge' | 'clean-then-merge' | 'replace';
}

export interface ModsConfig {
  enabled?: boolean;
  targets?: ModTarget[];
  applyWhileRunning?: boolean;
}

export interface Manifest {
  id: string;
  name: string;
  version: string;
  description: string;
  runtime: RuntimeConfig;
  storage: StorageConfig;
  variables: VariableConfig[];
  install?: InstallConfig;
  config?: ConfigRendering;
  ports: PortConfig[];
  start: StartConfig;
  health?: HealthConfig;
  shutdown?: ShutdownConfig;
  mods?: ModsConfig;
  rcon?: RCONConfig;
}

export interface CreatePackRequest {
  id: string;
  name: string;
  version: string;
  description: string;
  runtime: RuntimeConfig;
  storage: StorageConfig;
  variables?: VariableConfig[];
  install?: InstallConfig;
  config?: ConfigRendering;
  ports: PortConfig[];
  start: StartConfig;
  health?: HealthConfig;
  shutdown?: ShutdownConfig;
  mods?: ModsConfig;
  rcon?: RCONConfig;
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

export interface ConsoleMessage {
  type: 'command';
  payload: string;
}

export interface ConsoleResponse {
  type: 'response' | 'error' | 'status';
  payload: string;
  time: string;
}
