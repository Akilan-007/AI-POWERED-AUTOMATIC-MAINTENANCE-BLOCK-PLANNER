import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AlertTriangle, Zap, XCircle } from 'lucide-react';
import { DisruptionEvent } from '../types';

interface DisruptionContextType {
  activeDisruption: DisruptionEvent | null;
  triggerMockDisruption: () => void;
  clearDisruption: () => void;
}

const DisruptionContext = createContext<DisruptionContextType | undefined>(undefined);

export const useDisruption = (): DisruptionContextType => {
  const context = useContext(DisruptionContext);
  if (!context) throw new Error('useDisruption must be used within a DisruptionProvider');
  return context;
};

export const DisruptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeDisruption, setActiveDisruption] = useState<DisruptionEvent | null>(null);

  const triggerMockDisruption = () => {
    setActiveDisruption({
      id: `EVT-${Math.floor(Math.random() * 10000)}`,
      assetId: 'KRR', 
      type: 'OHE_CATENARY_SNAP',
      description: 'High-voltage catenary wire snapped. Immediate power isolation required on Mainline.',
      severity: 'CRITICAL',
      timestamp: new Date().toISOString(),
      estimatedDowntimeHours: 4.5,
    });
  };

  const clearDisruption = () => setActiveDisruption(null);

  return (
    <DisruptionContext.Provider value={{ activeDisruption, clearDisruption, triggerMockDisruption }}>
      {/* Tactical HUD Alert Banner */}
      {activeDisruption && (
        <div role="alert" aria-live="assertive" className="relative z-[999] w-full border-b border-red-500/50 bg-red-950/90 px-6 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-red-500/20 text-red-500">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold tracking-widest text-red-400">
                  CRITICAL DISRUPTION DETECTED: {activeDisruption.assetId}
                </h3>
                <p className="font-mono text-xs text-slate-300">{activeDisruption.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right font-mono text-xs text-red-300">
                <p>Est. Downtime: {activeDisruption.estimatedDowntimeHours} HRS</p>
                <p className="animate-pulse font-bold text-cyan-400">CP-SAT RECALCULATING...</p>
              </div>
              <button onClick={clearDisruption} className="flex items-center gap-2 rounded border border-red-500/50 bg-red-900/50 px-3 py-1 font-mono text-xs text-red-200 transition-colors hover:bg-red-800">
                <XCircle size={14} />
                RESOLVE & CLEAR
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Dev Trigger Button */}
      {!activeDisruption && (
        <button onClick={triggerMockDisruption} className="fixed bottom-6 right-6 z-[999] flex items-center gap-2 rounded-md border border-amber-500/50 bg-[#101822]/95 px-4 py-2 font-mono text-xs font-bold text-amber-500 shadow-lg shadow-amber-900/20 backdrop-blur-sm transition-all hover:bg-amber-950">
          <Zap className="animate-pulse" size={14} />
          SIMULATE DISRUPTION
        </button>
      )}
      {children}
    </DisruptionContext.Provider>
  );
};
