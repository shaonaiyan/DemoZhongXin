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

// Add and Deploy a new game
app.post('/api/deploy', async (req, res) => {
  const { name, repoUrl, path: gamePath, description, coverImage } = req.body;

  if (!name || !repoUrl || !gamePath) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Clean path (remove leading/trailing slashes)
  const cleanPath = gamePath.replace(/^\/+|\/+$/g, '');
  const targetDir = path.join(GAMES_DIR, cleanPath);

  try {
    console.log(`Deploying ${name} to ${targetDir}...`);

    // 1. Check if directory exists, if so, clean it
    if (await fs.pathExists(targetDir)) {
      console.log(`Directory ${targetDir} exists, removing...`);
      await fs.remove(targetDir);
    }

    // 2. Git Clone
    console.log(`Cloning ${repoUrl}...`);
    await runCommand(`git clone ${repoUrl} ${targetDir}`);

    // 3. Install & Build (Detect if it's a Node project)
    if (await fs.pathExists(path.join(targetDir, 'package.json'))) {
        console.log('Node project detected. Installing dependencies...');
        await runCommand(`cd ${targetDir} && npm install`);
        
        console.log('Building project...');
        // Try standard build commands
        try {
            await runCommand(`cd ${targetDir} && npm run build`);
        } catch (e) {
             console.warn('Build failed or no build script, assuming raw files or dist mismatch.');
        }
    }

    // 4. Update Nginx Config
    console.log('Updating Nginx configuration...');
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
            console.log('Reloading Nginx...');
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

    res.json({ success: true, game: newGame });

  } catch (error) {
    console.error('Deployment failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
