import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface TerminalProps {
  logs: LogEntry[];
  className?: string;
}

const Terminal: React.FC<TerminalProps> = ({ logs, className }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className={`font-mono bg-black/90 border border-gray-800 rounded-md p-4 overflow-hidden flex flex-col shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] ${className}`}>
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-800">
        <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]"></div>
        <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
        <span className="text-xs text-gray-500 ml-2 select-none">root@server:~# 部署流 (Deployment Stream)</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 pr-2 max-h-[400px]">
        {logs.length === 0 && (
          <div className="text-gray-600 italic">等待任务指令...</div>
        )}
        {logs.map((log, index) => (
          <div key={index} className="text-sm break-all font-mono">
            <span className="text-gray-600 mr-2">[{log.timestamp}]</span>
            <span className={
              log.type === 'error' ? 'text-red-500 font-bold' :
              log.type === 'success' ? 'text-green-400' :
              log.type === 'warning' ? 'text-yellow-400' :
              'text-gray-300'
            }>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default Terminal;