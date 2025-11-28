export interface Project {
  id: string;
  name: string;
  description: string;
  version: string;
  repoUrl: string;
  coverImage: string;
  path: string;
  status: 'online' | 'maintenance' | 'offline';
  lastUpdated: string;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export enum DeployStage {
  IDLE = 'IDLE',
  CLONING = 'CLONING',
  INSTALLING = 'INSTALLING',
  BUILDING = 'BUILDING',
  CONFIGURING = 'CONFIGURING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface DeploymentState {
  isDeploying: boolean;
  stage: DeployStage;
  logs: LogEntry[];
  errorAnalysis?: string;
}

export enum SystemUpgradeStage {
  IDLE = 'IDLE',
  CHECKING = 'CHECKING',
  BACKUP_CONFIG = 'BACKUP_CONFIG',
  PULLING_CORE = 'PULLING_CORE',
  INSTALLING_DEPS = 'INSTALLING_DEPS',
  RESTORING_CONFIG = 'RESTORING_CONFIG',
  REBOOTING = 'REBOOTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum ViewState {
  LOBBY = 'LOBBY',
  LOGIN = 'LOGIN',
  ADMIN = 'ADMIN'
}