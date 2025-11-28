import React from 'react';
import { Project } from '../types';

interface ProjectCardProps {
  project: Project;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const getStatusText = (status: Project['status']) => {
    switch(status) {
      case 'online': return '运行中';
      case 'maintenance': return '维护中';
      case 'offline': return '已离线';
      default: return status;
    }
  };

  return (
    <div className="group relative rounded-xl overflow-hidden glass-panel transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(6,182,212,0.25)] border border-white/5 hover:border-cyan-500/30">
      {/* Image Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent z-10 pointer-events-none" />
      
      {/* Background Image */}
      <div 
        className="h-52 w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
        style={{ backgroundImage: `url(${project.coverImage})` }}
      />

      {/* Content */}
      <div className="relative z-20 p-5 flex flex-col h-[200px]">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-cyber text-xl font-bold text-white group-hover:text-cyan-400 transition-colors drop-shadow-md">
              {project.name}
            </h3>
            <span className="text-[10px] text-gray-500 font-mono bg-black/30 px-1 rounded">
              {project.version}
            </span>
          </div>
          <span className={`px-2 py-0.5 text-xs font-mono rounded border backdrop-blur-md ${
            project.status === 'online' ? 'border-green-500/50 text-green-400 bg-green-900/20' :
            project.status === 'maintenance' ? 'border-yellow-500/50 text-yellow-400 bg-yellow-900/20' :
            'border-red-500/50 text-red-400 bg-red-900/20'
          }`}>
            {getStatusText(project.status)}
          </span>
        </div>
        
        <p className="text-sm text-gray-300 mb-4 line-clamp-2 flex-grow leading-relaxed font-light">
          {project.description}
        </p>

        <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
          <span className="text-xs text-gray-600 font-mono group-hover:text-gray-400 transition-colors">
            更新: {project.lastUpdated.split(' ')[0]}
          </span>
          <button className="px-5 py-2 bg-gradient-to-r from-cyan-900/50 to-blue-900/50 hover:from-cyan-600 hover:to-blue-600 text-cyan-400 hover:text-white border border-cyan-500/30 hover:border-cyan-400 rounded transition-all duration-300 font-bold text-xs shadow-[0_0_10px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            立即启动
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;