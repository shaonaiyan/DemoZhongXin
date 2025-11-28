import { Project } from './types';

export const INITIAL_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Neon Void',
    description: '迷幻风格的无尽虚空探索，基于 WebGL 的高性能渲染引擎。',
    version: 'v1.2.0',
    repoUrl: 'https://github.com/user/neon-void',
    coverImage: 'https://picsum.photos/seed/neon/600/400',
    path: '/neon-void/',
    status: 'online',
    lastUpdated: '2023-10-24 14:20'
  },
  {
    id: '2',
    name: 'Fruit Machine',
    description: '经典的复古像素风水果机模拟器，重温街机时代的纯粹乐趣。',
    version: 'v1.0.0',
    repoUrl: 'https://github.com/user/fruit-machine',
    coverImage: 'https://picsum.photos/seed/fruit/600/400',
    path: '/fruit-machine/',
    status: 'online',
    lastUpdated: '2023-11-02 09:15'
  },
  {
    id: '3',
    name: '像素地下城',
    description: '复古风格的多人在线 RPG，支持 WebSocket 实时对战。',
    version: 'v2.0.1',
    repoUrl: 'https://github.com/user/pixel-dungeon',
    coverImage: 'https://picsum.photos/seed/pixel/600/400',
    path: '/games/pixel-dungeon',
    status: 'maintenance',
    lastUpdated: '2023-11-05 16:45'
  }
];

export const MOCK_ADMIN_PASSWORD = 'admin';