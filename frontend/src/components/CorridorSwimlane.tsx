import React, { useEffect, useState } from 'react';
import { BlockPlan } from '../types';

interface CorridorSwimlaneProps {
  plans: BlockPlan[];
  selectedPlan: BlockPlan | null;
  onSelectPlan: (plan: BlockPlan) => void;
}

export const CorridorSwimlane: React.FC<CorridorSwimlaneProps> = ({
  plans,
  selectedPlan,
  onSelectPlan,
}) => {
  const [currentTimePos, setCurrentTimePos] = useState(0);

  // Derive lanes from plans
  const lanes = Array.from(new Set(plans.map(p => p.section_code || 'Mainline')));

  // Hours: 0 to 24
  const hours = Array.from({ length: 25 }, (_, i) => i);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pct = ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100;
      setCurrentTimePos(pct);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000); // every minute
    return () => clearInterval(interval);
  }, []);

  const timeToPct = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return ((h * 60 + (m || 0)) / (24 * 60)) * 100;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative">
      <div className="flex border-b border-slate-800 bg-slate-950/50">
        <div className="w-32 sm:w-48 shrink-0 border-r border-slate-800 p-3 text-xs font-bold text-slate-400">
          Section / Corridor
        </div>
        <div className="flex-1 relative h-10">
          {/* Time axis */}
          {hours.filter(h => h % 2 === 0).map(h => (
            <div
              key={h}
              className="absolute top-0 bottom-0 border-l border-slate-800/50 flex flex-col justify-end pb-1 pl-1"
              style={{ left: `${(h / 24) * 100}%` }}
            >
              <span className="text-[10px] text-slate-500 font-mono">
                {h.toString().padStart(2, '0')}:00
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* Live 'Now' Cursor */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
          style={{ left: `${currentTimePos}%` }}
        >
          <div className="absolute top-0 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
        </div>

        {/* Lanes */}
        {lanes.map(lane => (
          <div key={lane} className="flex border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 transition-colors">
            <div className="w-32 sm:w-48 shrink-0 border-r border-slate-800 p-3 flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-slate-200">{lane}</span>
            </div>
            
            <div className="flex-1 relative h-16 bg-slate-950/30">
              {/* Hour grid lines */}
              {hours.filter(h => h % 2 === 0).map(h => (
                <div
                  key={h}
                  className="absolute top-0 bottom-0 border-l border-slate-800/30"
                  style={{ left: `${(h / 24) * 100}%` }}
                />
              ))}

              {/* Blocks */}
              {plans.filter(p => (p.section_code || 'Mainline') === lane).map(plan => {
                const start = timeToPct(plan.window_start || '00:00');
                const end = timeToPct(plan.window_end || '01:00');
                const isSelected = selectedPlan?.id === plan.id;
                
                return (
                  <div
                    key={plan.id}
                    onClick={() => onSelectPlan(plan)}
                    className={`absolute top-2 bottom-2 rounded cursor-pointer border flex flex-col justify-center px-2 overflow-hidden transition-all ${
                      isSelected 
                        ? 'bg-purple-900/80 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)] z-10' 
                        : plan.is_integrated 
                          ? 'bg-blue-900/60 border-blue-600 hover:border-blue-400' 
                          : 'bg-slate-800 border-slate-600 hover:border-slate-400'
                    }`}
                    style={{ left: `${start}%`, width: `${end - start}%` }}
                    title={`Score: ${plan.optimization_score} | Tasks: ${plan.block_tasks.length}`}
                  >
                    <div className="text-[10px] font-bold text-white truncate font-mono">
                      {plan.window_start?.slice(0, 5)} - {plan.window_end?.slice(0, 5)}
                    </div>
                    {isSelected && (
                      <div className="text-[9px] text-purple-200 truncate hidden sm:block mt-0.5">
                        {plan.is_integrated ? 'INTEGRATED' : 'STANDARD'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {lanes.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500">
            No active lanes to display.
          </div>
        )}
      </div>
    </div>
  );
};
