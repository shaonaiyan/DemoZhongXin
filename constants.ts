import { Project } from './types';

export const INITIAL_PROJECTS: Project[] = [
  {
    id: '1',
    name: '赛博弹球 2077',
    description: '基于 WebGL 的高性能物理引擎弹球游戏，拥有极致的光影效果。',
    version: 'v1.2.0',
    repoUrl: 'https://github.com/user/cyber-pinball',
    coverImage: 'https://picsum.photos/seed/cyber1/600/400',
    path: '/games/cyber-pinball',
    status: 'online',
    lastUpdated: '2023-10-24 14:20'
  },
  {
    id: '2',
    name: '迷失太空',
    description: 'roguelike 太空探索生存游戏，无尽的宇宙等待发现。',
    version: 'v0.8.5-beta',
    repoUrl: 'https://github.com/user/space-lost',
    coverImage: 'https://picsum.photos/seed/space/600/400',
    path: '/games/space-lost',
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