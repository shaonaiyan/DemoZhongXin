import React, { useState, useEffect, useCallback } from 'react';
import { ViewState, DeploymentState, DeployStage, Project, LogEntry, SystemUpgradeStage } from './types';
import { INITIAL_PROJECTS, MOCK_ADMIN_PASSWORD } from './constants';
import { simulateDeployment, checkForSystemUpdates, simulateSystemUpgrade } from './services/mockServer';
import { analyzeErrorLogs } from './services/geminiService';
import Terminal from './components/Terminal';
import ProjectCard from './components/ProjectCard';

// --- Edit Modal Component (Internal) ---
interface EditModalProps {
  project: Project;
  onSave: (p: Project) => void;
  onCancel: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ project, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Project>({ ...project });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel p-6 rounded-xl w-full max-w-lg border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.2)] max-h-[90vh] overflow-y-auto custom-scrollbar">
        <h3 className="text-xl font-cyber font-bold text-white mb-6 border-b border-gray-700 pb-2">
          配置项目 <span className="text-cyan-400">Settings</span>
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-mono block mb-1">项目名称 (NAME)</label>
            <input 
              className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-mono block mb-1">仓库地址 (REPO URL)</label>
            <input 
              className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm focus:border-cyan-500 focus:outline-none font-mono"
              value={formData.repoUrl}
              onChange={e => setFormData({...formData, repoUrl: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-mono block mb-1">封面图片 (COVER IMAGE)</label>
            <div className="flex gap-2">
              <input 
                className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm focus:border-cyan-500 focus:outline-none font-mono"
                value={formData.coverImage}
                onChange={e => setFormData({...formData, coverImage: e.target.value})}
              />
              <div className="w-10 h-10 rounded border border-gray-700 bg-cover bg-center shrink-0" style={{backgroundImage: `url(${formData.coverImage})`}} />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 font-mono block mb-1">版本号 (VERSION)</label>
              <input 
                className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm focus:border-cyan-500 focus:outline-none font-mono"
                value={formData.version}
                onChange={e => setFormData({...formData, version: e.target.value})}
              />
            </div>
            <div className="flex-1">
               <label className="text-xs text-gray-500 font-mono block mb-1">运行状态 (STATUS)</label>
               <select 
                 className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
                 value={formData.status}
                 onChange={e => setFormData({...formData, status: e.target.value as any})}
               >
                 <option value="online">运行中 (Online)</option>
                 <option value="maintenance">维护中 (Maintenance)</option>
                 <option value="offline">已下线 (Offline)</option>
               </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-mono block mb-1">描述 (DESCRIPTION)</label>
            <textarea 
              className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-sm focus:border-cyan-500 focus:outline-none h-24"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">取消</button>
          <button onClick={() => onSave(formData)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm font-bold shadow-lg shadow-cyan-500/20">保存更改</button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.LOBBY);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);
  
  // Initialize projects from localStorage or default
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const savedProjects = localStorage.getItem('demo_center_projects');
      return savedProjects ? JSON.parse(savedProjects) : INITIAL_PROJECTS;
    } catch (e) {
      console.error("Failed to load projects from storage", e);
      return INITIAL_PROJECTS;
    }
  });
  
  // Persist projects whenever they change
  useEffect(() => {
    localStorage.setItem('demo_center_projects', JSON.stringify(projects));
  }, [projects]);

  // Admin Management State
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // System Upgrade State
  const [systemVersion, setSystemVersion] = useState(() => {
    return localStorage.getItem('demo_center_sys_version') || 'v1.8.4';
  });
  
  // Persist system version
  useEffect(() => {
    localStorage.setItem('demo_center_sys_version', systemVersion);
  }, [systemVersion]);

  const [latestSystemVersion, setLatestSystemVersion] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [upgradeState, setUpgradeState] = useState<{
    stage: SystemUpgradeStage;
    logs: LogEntry[];
  }>({
    stage: SystemUpgradeStage.IDLE,
    logs: []
  });

  // Deployment State
  const [repoUrl, setRepoUrl] = useState('');
  const [forceFail, setForceFail] = useState(false);
  const [deployState, setDeployState] = useState<DeploymentState>({
    isDeploying: false,
    stage: DeployStage.IDLE,
    logs: [],
    errorAnalysis: undefined
  });

  // --- Auth Handler ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === MOCK_ADMIN_PASSWORD) {
      setView(ViewState.ADMIN);
      setAuthError(false);
      setPassword('');
    } else {
      setAuthError(true);
    }
  };

  // --- Project CRUD Handlers ---
  const handleDeleteProject = (id: string) => {
    if (window.confirm('确定要销毁该项目吗？此操作不可逆！\nConfirm deletion?')) {
      setProjects(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleUpdateProject = (updatedProject: Project) => {
    const projectWithTimestamp = {
      ...updatedProject,
      lastUpdated: new Date().toLocaleString()
    };
    setProjects(prev => prev.map(p => p.id === projectWithTimestamp.id ? projectWithTimestamp : p));
    setEditingProject(null);
  };

  // --- System Upgrade Handlers ---
  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    const newVersion = await checkForSystemUpdates();
    setLatestSystemVersion(newVersion);
    setIsCheckingUpdate(false);
  };

  const handleSystemEvolve = async () => {
    if (!latestSystemVersion) return;
    
    setUpgradeState({ stage: SystemUpgradeStage.CHECKING, logs: [] });
    
    await simulateSystemUpgrade(
      latestSystemVersion,
      (log) => setUpgradeState(prev => ({ ...prev, logs: [...prev.logs, log] })),
      (stage) => {
        setUpgradeState(prev => ({ ...prev, stage }));
        if (stage === SystemUpgradeStage.COMPLETED) {
          setTimeout(() => {
            setSystemVersion(latestSystemVersion);
            setLatestSystemVersion(null);
            alert("系统进化完成。所有服务已重启。\nSystem Upgrade Successful.");
          }, 500);
        }
      }
    );
  };

  // --- Deploy Handler ---
  const handleDeploy = useCallback(async () => {
    if (!repoUrl) return;

    // Reset State
    setDeployState({
      isDeploying: true,
      stage: DeployStage.CLONING,
      logs: [],
      errorAnalysis: undefined
    });

    await simulateDeployment(
      repoUrl,
      forceFail,
      // On Log
      (log) => {
        setDeployState(prev => ({
          ...prev,
          logs: [...prev.logs, log]
        }));
      },
      // On Stage Change
      async (stage) => {
        setDeployState(prev => ({ ...prev, stage }));
        
        // If Failed, Trigger Gemini Analysis
        if (stage === DeployStage.FAILED) {
           // Wait slightly for logic to settle then trigger analysis
           // Note: actual analysis call is in useEffect to ensure latest state logs
        }
      }
    );

    setDeployState(prev => ({ ...prev, isDeploying: false }));
  }, [repoUrl, forceFail]);

  // Effect to trigger Gemini when stage becomes FAILED
  useEffect(() => {
    if (deployState.stage === DeployStage.FAILED && !deployState.errorAnalysis) {
      const runAnalysis = async () => {
        setDeployState(prev => ({ ...prev, errorAnalysis: '正在召唤 AI 进行故障分析...' }));
        const analysis = await analyzeErrorLogs(deployState.logs);
        setDeployState(prev => ({ ...prev, errorAnalysis: analysis }));
      };
      runAnalysis();
    } else if (deployState.stage === DeployStage.COMPLETED) {
       // Check if project already exists (mock update) or create new
       const newProject: Project = {
         id: Date.now().toString(),
         name: `New Project (${repoUrl.split('/').pop()})`,
         description: '刚刚自动部署的新项目，请在管理列表中配置详细信息。',
         version: 'v1.0.0',
         repoUrl: repoUrl,
         coverImage: `https://picsum.photos/seed/${Date.now()}/600/400`,
         path: '/new-game',
         status: 'online',
         lastUpdated: new Date().toLocaleString()
       };
       setProjects(prev => [newProject, ...prev]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployState.stage]);

  // --- Render Views ---

  const renderHeader = () => (
    <header className="sticky top-0 z-50 glass-panel border-b-0 border-b border-white/10 px-6 py-4 flex justify-between items-center mb-8">
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView(ViewState.LOBBY)}>
        <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform">
          <span className="font-cyber font-bold text-white text-lg">D</span>
        </div>
        <h1 className="font-cyber text-2xl font-bold tracking-wider text-white">
          <span className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">TINY</span>.DEMO_CENTER
        </h1>
      </div>
      <div className="flex items-center gap-4">
        {view !== ViewState.LOBBY && (
          <button 
            onClick={() => setView(ViewState.LOBBY)}
            className="text-xs font-mono text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <span>&larr;</span> 返回大厅
          </button>
        )}
        {view === ViewState.LOBBY && (
          <button 
            onClick={() => setView(ViewState.LOGIN)}
            className="px-4 py-1.5 text-xs font-bold font-mono border border-gray-600 rounded text-gray-300 hover:border-cyan-400 hover:text-cyan-400 hover:bg-cyan-900/20 transition-all uppercase tracking-wider"
          >
            管理员入口
          </button>
        )}
      </div>
    </header>
  );

  const renderLobby = () => (
    <div className="container mx-auto px-4 pb-20 animate-fade-in">
      <div className="mb-12 text-center relative">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 neon-text-cyan tracking-tight">沉浸式游戏体验中心</h2>
        <div className="w-24 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto mb-6"></div>
        <p className="text-gray-400 max-w-2xl mx-auto font-mono text-sm leading-relaxed">
          Access high-performance WebGL demos. <br/>Deployed via automated pipelines.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass-panel p-8 rounded-2xl w-full max-w-md relative overflow-hidden border border-gray-700/50">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-pink-500" />
        <h2 className="text-2xl font-cyber font-bold text-white mb-8 flex items-center gap-3">
          <span className="text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]">SYSTEM</span>.LOGIN
        </h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">访问密钥 (Access Key)</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-gray-700 rounded p-4 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono tracking-widest placeholder-gray-700"
              placeholder="••••••••"
            />
          </div>
          {authError && (
            <div className="text-red-400 text-xs font-mono border border-red-900/50 bg-red-900/10 p-3 rounded flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              ACCESS DENIED: 密钥无效
            </div>
          )}
          <button 
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 text-white font-bold rounded shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all uppercase tracking-[0.2em] font-mono text-sm"
          >
            验证身份
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-gray-600 font-mono">
           提示: 默认密钥 'admin'
        </p>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="container mx-auto px-4 pb-20 max-w-6xl">
      {editingProject && (
        <EditModal 
          project={editingProject} 
          onSave={handleUpdateProject} 
          onCancel={() => setEditingProject(null)} 
        />
      )}

      {/* System Self-Evolution Panel */}
      <div className="glass-panel rounded-2xl p-6 md:p-8 border border-purple-500/30 mb-8 bg-purple-900/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <svg className="w-48 h-48 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/>
          </svg>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 relative z-10">
          <div>
            <h2 className="text-2xl font-cyber font-bold text-white flex items-center gap-3">
              <span className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">SYSTEM</span>.EVOLUTION
            </h2>
            <p className="text-gray-400 font-mono text-xs mt-2">
              Current Core Version: <span className="text-white font-bold">{systemVersion}</span>
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-4">
            {!latestSystemVersion ? (
              <button 
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate || upgradeState.stage !== SystemUpgradeStage.IDLE}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded font-mono text-xs tracking-wider border border-gray-600 transition-all flex items-center gap-2"
              >
                {isCheckingUpdate ? 'Checking...' : '检查更新 (CHECK UPDATE)'}
              </button>
            ) : (
              <div className="flex items-center gap-4 bg-purple-900/40 p-1.5 pr-2 rounded-lg border border-purple-500/50">
                <span className="text-xs font-mono text-purple-200 pl-2">
                  New Version Found: <span className="text-white font-bold">{latestSystemVersion}</span>
                </span>
                <button 
                  onClick={handleSystemEvolve}
                  disabled={upgradeState.stage !== SystemUpgradeStage.IDLE}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold font-mono text-xs animate-pulse-slow shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                >
                  立即进化 (EVOLVE SYSTEM)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* System Upgrade Terminal */}
        {(upgradeState.stage !== SystemUpgradeStage.IDLE || upgradeState.logs.length > 0) && (
          <div className="mt-4 animate-fade-in-up">
            <div className="bg-black/80 rounded-t-md px-4 py-2 flex justify-between items-center border border-purple-500/30 border-b-0">
               <span className="text-xs font-mono text-purple-400">EVOLUTION_PROCESS_LOG</span>
               <span className="text-[10px] font-mono text-gray-500">PID: 9999</span>
            </div>
            <Terminal logs={upgradeState.logs} className="h-[200px] border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.1)]" />
          </div>
        )}
      </div>

      {/* Deployment Section */}
      <div className="glass-panel rounded-2xl p-6 md:p-10 border-t border-cyan-500/30 mb-10">
        <div className="flex justify-between items-end mb-8 border-b border-gray-800 pb-6">
          <div>
            <h2 className="text-3xl font-cyber font-bold text-white neon-text-pink">部署控制台</h2>
            <p className="text-gray-400 font-mono text-sm mt-2">Deployment Console // Automated Pipeline</p>
          </div>
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded border border-gray-800">
             <label className="text-xs text-gray-500 font-mono cursor-pointer select-none" htmlFor="forceFail">模拟失败 (Force Fail)</label>
             <input 
              id="forceFail"
              type="checkbox" 
              checked={forceFail} 
              onChange={e => setForceFail(e.target.checked)} 
              className="accent-pink-500 w-4 h-4 cursor-pointer"
            />
          </div>
        </div>

        {/* Input Area */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-grow">
             <label className="block text-xs font-mono text-gray-500 mb-2">GIT 仓库地址 (REPOSITORY URL)</label>
             <input 
                type="text" 
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/project.git"
                disabled={deployState.isDeploying}
                className="w-full bg-black/40 border border-gray-700 rounded-lg p-4 text-cyan-100 focus:border-cyan-500 focus:outline-none font-mono placeholder-gray-700 transition-colors"
             />
          </div>
          <div className="flex items-end">
            <button 
              onClick={handleDeploy}
              disabled={deployState.isDeploying || !repoUrl}
              className={`h-[58px] px-8 rounded-lg font-bold font-mono tracking-wider transition-all flex items-center gap-2 min-w-[180px] justify-center
                ${deployState.isDeploying 
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' 
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-500/50'
                }`}
            >
              {deployState.isDeploying ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  部署中...
                </>
              ) : '开始部署'}
            </button>
          </div>
        </div>

        {/* Status & Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Terminal */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono text-gray-400">实时构建日志 (LIVE LOGS)</span>
              {deployState.stage !== DeployStage.IDLE && (
                 <span className={`text-xs font-bold px-2 py-1 rounded font-mono ${
                   deployState.stage === DeployStage.FAILED ? 'bg-red-900/50 text-red-400 border border-red-500/30' : 
                   deployState.stage === DeployStage.COMPLETED ? 'bg-green-900/50 text-green-400 border border-green-500/30' : 'bg-blue-900/50 text-blue-400 border border-blue-500/30'
                 }`}>
                   状态: {deployState.stage}
                 </span>
              )}
            </div>
            <Terminal logs={deployState.logs} className="h-[400px]" />
          </div>

          {/* AI Analysis Panel */}
          <div className="glass-panel border border-pink-500/20 bg-pink-900/5 rounded-lg p-4 flex flex-col h-[432px]">
             <div className="flex items-center gap-2 mb-4 pb-2 border-b border-pink-500/20">
               <span className="text-xl">🧠</span>
               <h3 className="font-cyber font-bold text-pink-400">智能核心诊断</h3>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar">
               {!deployState.errorAnalysis ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm font-mono text-center opacity-60">
                   <div className="w-12 h-12 rounded-full border border-gray-700 flex items-center justify-center mb-3">
                     <span className="animate-pulse">...</span>
                   </div>
                   <p>系统待机中</p>
                   <p className="mt-2 text-xs">若构建失败，AI 将自动介入分析。</p>
                 </div>
               ) : (
                 <div className="animate-fade-in">
                   <p className="text-sm text-pink-200 leading-relaxed whitespace-pre-wrap font-mono">
                     {deployState.errorAnalysis}
                   </p>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>

      {/* Project Management Section */}
      <div className="glass-panel rounded-2xl p-6 md:p-10 border-t border-blue-500/30">
        <div className="mb-6 border-b border-gray-800 pb-4">
          <h2 className="text-2xl font-cyber font-bold text-white text-blue-300">已部署项目管理</h2>
          <p className="text-gray-400 font-mono text-xs mt-1">Asset Management // Configuration</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-mono text-gray-500 border-b border-gray-800">
                <th className="py-3 pl-2">项目名称</th>
                <th className="py-3">版本</th>
                <th className="py-3">状态</th>
                <th className="py-3">最后更新</th>
                <th className="py-3 text-right pr-2">操作</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {projects.length === 0 ? (
                <tr>
                   <td colSpan={5} className="py-8 text-center text-gray-600 font-mono">暂无已部署项目</td>
                </tr>
              ) : projects.map(p => (
                <tr key={p.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors group">
                  <td className="py-4 pl-2 font-bold text-gray-200 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-cover bg-center hidden md:block border border-gray-700" style={{backgroundImage: `url(${p.coverImage})`}} />
                    {p.name}
                  </td>
                  <td className="py-4 font-mono text-gray-400">{p.version || 'v1.0'}</td>
                  <td className="py-4">
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      p.status === 'online' ? 'border-green-500/30 text-green-400 bg-green-500/5' :
                      p.status === 'maintenance' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5' :
                      'border-red-500/30 text-red-400 bg-red-500/5'
                    }`}>
                      {p.status === 'online' ? '运行中' : p.status === 'maintenance' ? '维护中' : '已离线'}
                    </span>
                  </td>
                  <td className="py-4 text-gray-500 font-mono text-xs">{p.lastUpdated}</td>
                  <td className="py-4 text-right pr-2">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setEditingProject(p)}
                        className="p-2 hover:bg-blue-500/20 rounded text-blue-400 transition-colors"
                        title="设置"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleDeleteProject(p.id)}
                        className="p-2 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                        title="删除"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[url('https://picsum.photos/seed/cybergrid/1920/1080')] bg-fixed bg-cover">
      <div className="min-h-screen bg-gray-900/90 backdrop-blur-sm">
        {renderHeader()}
        
        <main className="animate-fade-in-up">
          {view === ViewState.LOBBY && renderLobby()}
          {view === ViewState.LOGIN && renderLogin()}
          {view === ViewState.ADMIN && renderAdmin()}
        </main>

        <footer className="fixed bottom-0 w-full py-2 bg-black/80 border-t border-gray-800 text-center text-xs text-gray-600 font-mono z-40 backdrop-blur">
           SYSTEM STATUS: ONLINE | LATENCY: 12ms | NODE: v18.17.0
        </footer>
      </div>
    </div>
  );
};

export default App;