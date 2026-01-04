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

// SSH Key types
export interface SSHKey {
  id: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  keyType: 'ssh-rsa' | 'ssh-ed25519' | 'ecdsa-sha2-nistp256' | 'ecdsa-sha2-nistp384' | 'ecdsa-sha2-nistp521';
  createdAt: string;
  lastUsedAt?: string;
}

export interface CreateSSHKeyRequest {
  name: string;
  publicKey: string;
}

// SFTP Config types
export interface SFTPConnectionInfo {
  host: string;
  port: number;
  username: string;
}

export interface SFTPConfig {
  enabled: boolean;
  sshKeyId?: string;
  sshKeyName?: string;
  username: string;
  hasPassword: boolean;
  connectionInfo: SFTPConnectionInfo;
}

export interface UpdateSFTPConfigRequest {
  enabled?: boolean;
  sshKeyId?: string;
}

export interface SFTPStatus {
  running: boolean;
  enabled: boolean;
  port: number;
  hostFingerprint?: string;
  activeSessions?: number;
}

// System config types
export interface SystemConfigRunning {
  sftpEnabled: boolean;
  sftpPort: number;
  portRangeStart: number;
  portRangeEnd: number;
  dockerHost: string;
  dataDir: string;
  databasePath: string;
  packsDir: string;
}

export interface SystemConfigSaved {
  sftpEnabled?: boolean;
  sftpPort?: string;
  portRangeStart?: number;
  portRangeEnd?: number;
  dockerHost?: string;
}

export interface SystemConfig {
  running: SystemConfigRunning;
  saved: SystemConfigSaved;
  pendingRestart: boolean;
  dockerConnected: boolean;
}

export interface UpdateSystemConfigRequest {
  sftpEnabled?: boolean;
  sftpPort?: number;
  portRangeStart?: number;
  portRangeEnd?: number;
  dockerHost?: string;
}
