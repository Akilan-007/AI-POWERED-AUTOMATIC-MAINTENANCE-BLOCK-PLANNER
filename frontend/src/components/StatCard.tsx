import React from 'react';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  accentColor?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan';
  subtext?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  change,
  changeType = 'positive',
  icon,
  accentColor = 'blue',
  subtext,
}) => {
  const iconGlow = {
    blue: 'bg-blue-950/60 text-blue-400 border-blue-800/50 shadow-[0_0_12px_rgba(59,130,246,0.25)]',
    emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
    amber: 'bg-amber-950/60 text-amber-400 border-amber-800/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    rose: 'bg-rose-950/60 text-rose-400 border-rose-800/50 shadow-[0_0_12px_rgba(244,63,94,0.25)]',
    purple: 'bg-purple-950/60 text-purple-400 border-purple-800/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]',
    cyan: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
  };

  return (
    <Card className="hover:border-slate-700/80">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {title}
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl font-bold tracking-tight text-slate-50">{value}</span>
            {unit && <span className="text-xs text-slate-400 font-medium">{unit}</span>}
          </div>
          {(change || subtext) && (
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              {change && (
                <span
                  className={`font-semibold ${
                    changeType === 'positive'
                      ? 'text-emerald-400'
                      : changeType === 'negative'
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {change}
                </span>
              )}
              {subtext && <span className="text-slate-400">{subtext}</span>}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg border ${iconGlow[accentColor]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
};
