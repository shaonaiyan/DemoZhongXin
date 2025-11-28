import { LogEntry, DeployStage, SystemUpgradeStage } from '../types';

// This service simulates the Node.js backend + Shell execution
// In a real app, this would be WebSocket logic connecting to the Express server.

type LogCallback = (log: LogEntry) => void;
type StageCallback = (stage: DeployStage) => void;
type UpgradeStageCallback = (stage: SystemUpgradeStage) => void;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createLog = (message: string, type: LogEntry['type'] = 'info'): LogEntry => ({
  timestamp: new Date().toLocaleTimeString(),
  message,
  type
});

export const simulateDeployment = async (
  repoUrl: string, 
  shouldFail: boolean,
  onLog: LogCallback,
  onStage: StageCallback
) => {
  try {
    // 1. Git Clone
    onStage(DeployStage.CLONING);
    onLog(createLog(`正在连接远程仓库: ${repoUrl}...`));
    await delay(1000);
    onLog(createLog(`Git Clone process started (PID: 1342)`));
    await delay(1500);
    onLog(createLog(`Receiving objects: 100% (234/234), 1.2MiB | 300.00 KiB/s`));
    onLog(createLog(`Resolving deltas: 100% (45/45)`));
    onLog(createLog(`代码拉取成功`, 'success'));

    // 2. Install Dependencies
    onStage(DeployStage.INSTALLING);
    onLog(createLog(`执行 npm install...`));
    await delay(800);
    onLog(createLog(`npm WARN deprecated stable@0.1.8: Modern JS already guarantees Array#sort is stable`));
    await delay(1200);
    
    if (shouldFail) {
      // Simulate a failure here
      throw new Error("npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE unable to resolve dependency tree\nnpm ERR! Conflicting peer dependency: react@16.8.0");
    }

    onLog(createLog(`added 1423 packages in 4s`, 'success'));
    onLog(createLog(`12 packages are looking for funding`));

    // 3. Build
    onStage(DeployStage.BUILDING);
    onLog(createLog(`执行 npm run build...`));
    await delay(1000);
    onLog(createLog(`> react-scripts build`));
    onLog(createLog(`Creating an optimized production build...`));
    await delay(2000);
    onLog(createLog(`Compiled successfully.`));
    onLog(createLog(`File sizes after gzip:\n  45.32 KB  build/static/js/main.0321.js\n  1.20 KB   build/static/css/main.1231.css`, 'info'));

    // 4. Nginx Config
    onStage(DeployStage.CONFIGURING);
    onLog(createLog(`生成 Nginx 配置文件...`));
    await delay(600);
    onLog(createLog(`Writing /etc/nginx/sites-available/demo_game.conf`));
    onLog(createLog(`Linking to /etc/nginx/sites-enabled/`));
    
    // 5. Reload & Update JSON
    onLog(createLog(`执行 nginx -s reload`));
    await delay(800);
    onLog(createLog(`Updating projects.json metadata...`));
    onLog(createLog(`部署流程全部完成!`, 'success'));
    onStage(DeployStage.COMPLETED);

  } catch (err: any) {
    onLog(createLog(err.message || "Unknown Error", 'error'));
    onLog(createLog(`Process exited with code 1`, 'error'));
    onStage(DeployStage.FAILED);
  }
};

// System Upgrade Simulation

export const checkForSystemUpdates = async (): Promise<string | null> => {
  await delay(1500);
  // Simulate a 50% chance of finding an update, or just always find one for demo purposes
  const hasUpdate = Math.random() > 0.3; 
  return hasUpdate ? 'v2.0.0-cyber' : null;
};

export const simulateSystemUpgrade = async (
  targetVersion: string,
  onLog: LogCallback,
  onStage: UpgradeStageCallback
) => {
  try {
    // 1. Backup
    onStage(SystemUpgradeStage.BACKUP_CONFIG);
    onLog(createLog(`正在启动系统进化进程 (Target: ${targetVersion})...`, 'warning'));
    await delay(1000);
    onLog(createLog(`[PROTECTION] 检测到关键配置文件 projects.json`));
    onLog(createLog(`[PROTECTION] Creating secure snapshot: /tmp/projects_backup_${Date.now()}.json...`, 'success'));
    await delay(1000);

    // 2. Pull
    onStage(SystemUpgradeStage.PULLING_CORE);
    onLog(createLog(`Fetching updates from origin/main...`));
    await delay(1500);
    onLog(createLog(`Updating refs: 100% (12/12)`));
    onLog(createLog(`Fast-forwarding core system files...`));

    // 3. Install
    onStage(SystemUpgradeStage.INSTALLING_DEPS);
    onLog(createLog(`Installing new system dependencies...`));
    await delay(2000);
    onLog(createLog(`Removed 5 packages, changed 12 packages.`));

    // 4. Restore
    onStage(SystemUpgradeStage.RESTORING_CONFIG);
    onLog(createLog(`[PROTECTION] Restoring user configuration...`));
    await delay(800);
    onLog(createLog(`[PROTECTION] projects.json verification passed.`, 'success'));

    // 5. Reboot
    onStage(SystemUpgradeStage.REBOOTING);
    onLog(createLog(`Reloading PM2 process list...`));
    onLog(createLog(`Applying new environment variables...`));
    await delay(2000);
    
    onLog(createLog(`System Evolution Complete. Welcome to ${targetVersion}.`, 'success'));
    onStage(SystemUpgradeStage.COMPLETED);

  } catch (err: any) {
    onLog(createLog(`Upgrade Critical Failure: ${err.message}`, 'error'));
    onLog(createLog(`Rolling back to previous snapshot...`, 'warning'));
    onStage(SystemUpgradeStage.FAILED);
  }
};