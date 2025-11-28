const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// --- Configuration ---
const GAMES_DIR = '/var/www'; // Where games are deployed
const NGINX_CONFIG_PATH = '/etc/nginx/conf.d/game.conf';
const GAMES_JSON_PATH = path.join(__dirname, 'games.json');

// --- In-Memory Job Store ---
const jobs = {};

// --- Helper Functions ---

// Load games from local JSON file
const loadGames = async () => {
  try {
    if (await fs.pathExists(GAMES_JSON_PATH)) {
      return await fs.readJson(GAMES_JSON_PATH);
    }
    return [];
  } catch (error) {
    console.error("Error loading games:", error);
    return [];
  }
};

// Save games to local JSON file
const saveGames = async (games) => {
  try {
    await fs.writeJson(GAMES_JSON_PATH, games, { spaces: 2 });
  } catch (error) {
    console.error("Error saving games:", error);
  }
};

// Execute shell command
const runCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Exec error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.warn(`Exec stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
};

// Shared Build Logic
const performBuild = async (targetDir, cleanPath, log) => {
    if (await fs.pathExists(path.join(targetDir, 'package.json'))) {
        log('Node project detected. Installing dependencies...');
        // Note: npm install can be slow
        await runCommand(`cd ${targetDir} && npm install`);
        
        log('Building project...');
        let buildCmd = `cd ${targetDir} && npm run build`;
        
        // Check for Vite
        try {
            const pkg = await fs.readJson(path.join(targetDir, 'package.json'));
            const isVite = pkg.devDependencies?.vite || pkg.dependencies?.vite;
            if (isVite) {
                log(`Detected Vite project. Setting base path to /${cleanPath}/`);
                // Pass base path to vite build
                buildCmd = `cd ${targetDir} && npm run build -- --base=/${cleanPath}/`;
            }
        } catch (e) {
            console.warn("Failed to read package.json", e);
        }

        try {
            await runCommand(buildCmd);
        } catch (e) {
             log('Build failed or no build script, assuming raw files or dist mismatch.', 'warning');
        }
    }
};

// --- API Routes ---

// Get all games
app.get('/api/games', async (req, res) => {
  const games = await loadGames();
  res.json(games);
});

// Sync/Save all games (for updates/deletes)
app.post('/api/games/sync', async (req, res) => {
  const { games } = req.body;
  if (!Array.isArray(games)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  await saveGames(games);
  res.json({ success: true });
});

// Get Job Status
app.get('/api/deploy/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// Add and Deploy a new game (Async)
app.post('/api/deploy', async (req, res) => {
  const { name, repoUrl, path: gamePath, description, coverImage } = req.body;

  if (!name || !repoUrl || !gamePath) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const jobId = Date.now().toString();
  jobs[jobId] = {
    id: jobId,
    status: 'pending',
    logs: [],
    result: null
  };

  res.json({ success: true, jobId });

  // Start background process
  deployBackground(jobId, { name, repoUrl, gamePath, description, coverImage });
});

// Update existing game (Async)
app.post('/api/update', async (req, res) => {
  const { id } = req.body;
  
  const games = await loadGames();
  const game = games.find(g => g.id === id);
  
  if (!game) {
      return res.status(404).json({ error: 'Game not found' });
  }

  const jobId = Date.now().toString();
  jobs[jobId] = {
    id: jobId,
    status: 'pending',
    logs: [],
    result: null
  };

  res.json({ success: true, jobId });

  // Start background process
  updateBackground(jobId, game);
});

// Smart Git Clone with Retry and Mirror Fallback
const gitClone = async (repoUrl, targetDir, log) => {
    const cleanRepoUrl = repoUrl.trim();
    
    // 1. Try Standard Clone (3 retries)
    for (let i = 0; i < 3; i++) {
        try {
            log(`Cloning ${cleanRepoUrl}... (Attempt ${i + 1}/3)`);
            await runCommand(`git clone ${cleanRepoUrl} ${targetDir}`);
            return;
        } catch (e) {
            log(`Clone attempt ${i + 1} failed.`, 'warning');
            if (i < 2) await new Promise(r => setTimeout(r, 2000));
        }
    }

    // 2. Try Mirror (if applicable)
    // Using ghproxy.com for github links
    if (cleanRepoUrl.startsWith('https://github.com/')) {
        const mirrorUrl = `https://mirror.ghproxy.com/${cleanRepoUrl}`;
        try {
             log(`Standard clone failed. Trying mirror: ${mirrorUrl}...`);
             await runCommand(`git clone ${mirrorUrl} ${targetDir}`);
             return;
        } catch (e) {
             log(`Mirror clone failed too.`, 'error');
        }
    }
    
    throw new Error('All clone attempts failed. Please check the URL or network.');
};

// Smart Git Pull with Retry
const gitPull = async (targetDir, log) => {
    for (let i = 0; i < 3; i++) {
        try {
            await runCommand(`cd ${targetDir} && git reset --hard HEAD && git pull`);
            return;
        } catch (e) {
             log(`Pull attempt ${i + 1} failed.`, 'warning');
             if (i < 2) await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw new Error('Git pull failed after multiple attempts.');
};

// Background Deployment Logic
const deployBackground = async (jobId, { name, repoUrl, gamePath, description, coverImage }) => {
  const job = jobs[jobId];
  const log = (msg, type = 'info') => {
    console.log(`[Job ${jobId}] ${msg}`);
    job.logs.push({ timestamp: new Date().toLocaleTimeString(), message: msg, type });
  };

  job.status = 'running';
  log(`Starting deployment for ${name}...`);

  // Clean path (remove leading/trailing slashes)
  const cleanPath = gamePath.replace(/^\/+|\/+$/g, '');
  const targetDir = path.join(GAMES_DIR, cleanPath);

  try {
    // 1. Check if directory exists, if so, clean it
    if (await fs.pathExists(targetDir)) {
      log(`Directory ${targetDir} exists, removing...`);
      await fs.remove(targetDir);
    }

    // 2. Git Clone
    await gitClone(repoUrl, targetDir, log);

    // 3. Install & Build

    await performBuild(targetDir, cleanPath, log);

    // 4. Update Nginx Config
    log('Updating Nginx configuration...');
    let nginxConfig = await fs.readFile(NGINX_CONFIG_PATH, 'utf8');
    
    // Check if location block already exists
    const locationBlock = `location /${cleanPath}/ {`;
    
    if (!nginxConfig.includes(locationBlock)) {
        // Determine root directory (dist or root)
        let rootDir = targetDir;
        if (await fs.pathExists(path.join(targetDir, 'dist'))) {
            rootDir = path.join(targetDir, 'dist');
        }
        
        const newBlock = `
    # Game: ${name}
    location /${cleanPath}/ {
        alias ${rootDir}/;
        index index.html;
    }
`;
        // Insert before the last closing brace
        const lastBraceIndex = nginxConfig.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
            nginxConfig = nginxConfig.slice(0, lastBraceIndex) + newBlock + nginxConfig.slice(lastBraceIndex);
            await fs.writeFile(NGINX_CONFIG_PATH, nginxConfig);
            
            // Reload Nginx
            log('Reloading Nginx...');
            await runCommand('nginx -s reload');
        }
    }

    // 5. Save to Database (JSON)
    const games = await loadGames();
    const newGame = {
      id: Date.now().toString(),
      name,
      repoUrl,
      path: `/${cleanPath}/`,
      description: description || '',
      coverImage: coverImage || 'https://picsum.photos/seed/game/600/400',
      status: 'online',
      lastUpdated: new Date().toISOString()
    };
    
    // Update or add
    const existingIndex = games.findIndex(g => g.path === newGame.path);
    if (existingIndex >= 0) {
        games[existingIndex] = newGame;
    } else {
        games.push(newGame);
    }
    
    await saveGames(games);

    job.status = 'completed';
    job.result = newGame;
    log('Deployment successful!', 'success');

  } catch (error) {
    console.error('Deployment failed:', error);
    job.status = 'failed';
    log(`Deployment failed: ${error.message}`, 'error');
  }
};

// Background Update Logic
const updateBackground = async (jobId, game) => {
  const job = jobs[jobId];
  const log = (msg, type = 'info') => {
    console.log(`[Job ${jobId}] ${msg}`);
    job.logs.push({ timestamp: new Date().toLocaleTimeString(), message: msg, type });
  };

  job.status = 'running';
  log(`Starting update for ${game.name}...`);

  const cleanPath = game.path.replace(/^\/+|\/+$/g, '');
  const targetDir = path.join(GAMES_DIR, cleanPath);

  try {
    // 1. Check if directory exists
    if (!await fs.pathExists(targetDir)) {
       throw new Error(`Directory ${targetDir} does not exist. Cannot update.`);
    }

    // 2. Git Pull
    log('Pulling latest changes from GitHub...');
    await gitPull(targetDir, log);

    // 3. Install & Build
    await performBuild(targetDir, cleanPath, log);
    
    // 4. Update Timestamp
    const games = await loadGames();
    const existingIndex = games.findIndex(g => g.id === game.id);
    if (existingIndex >= 0) {
        games[existingIndex].lastUpdated = new Date().toISOString();
        await saveGames(games);
    }

    job.status = 'completed';
    job.result = games[existingIndex];
    log('Update successful!', 'success');

  } catch (error) {
    console.error('Update failed:', error);
    job.status = 'failed';
    log(`Update failed: ${error.message}`, 'error');
  }
};

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
