import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, Clock, Activity, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  onRunOptimization: () => void;
  isOptimizing: boolean;
  lastOptimizedTime?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRunOptimization,
  isOptimizing,
  lastOptimizedTime,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      {/* Title & Status */}
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-100 tracking-tight">
              Maintenance Block Planning & Optimization
            </h1>
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Operations
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Tamil Nadu Trunk Corridor (Chennai - Katpadi - Salem) &bull; Southern Railway (ENG &bull; TD &bull; S&T)
          </p>
        </div>
      </div>

      {/* Actions & Timers */}
      <div className="flex items-center gap-3">
        {/* Clock */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{timeStr || '00:00:00'} IST</span>
        </div>

        {lastOptimizedTime && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Plan: {lastOptimizedTime}</span>
          </div>
        )}

        {/* Generate Plan Button */}
        <button
          onClick={onRunOptimization}
          disabled={isOptimizing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-md ${
            isOptimizing
              ? 'bg-slate-700 cursor-not-allowed opacity-80'
              : 'bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 shadow-violet-500/25 active:scale-98'
          }`}
        >
          {isOptimizing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Solving CP-SAT...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Generate Optimized Plan</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
