import React, { useState, useEffect } from 'react';
import { DatabaseZap } from 'lucide-react';
import { mockEventTarget } from '../services/api';

export const DemoModeIndicator: React.FC = () => {
  const [isActive, setIsActive] = useState<boolean>(
    import.meta.env.VITE_FORCE_MOCK_MODE === 'true'
  );

  useEffect(() => {
    const handleMockActivated = () => {
      setIsActive(true);
    };

    mockEventTarget.addEventListener('mock-activated', handleMockActivated);
    return () => {
      mockEventTarget.removeEventListener('mock-activated', handleMockActivated);
    };
  }, []);

  if (!isActive) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 shadow-lg shadow-black/20 backdrop-blur-sm pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
      <DatabaseZap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
      <span className="text-[10px] font-mono font-medium text-slate-300 uppercase tracking-wider">
        Offline Mode &mdash; Cached Data
      </span>
    </div>
  );
};
