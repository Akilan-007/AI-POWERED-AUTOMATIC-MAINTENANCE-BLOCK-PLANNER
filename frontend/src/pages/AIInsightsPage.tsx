import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldAlert, Zap, AlertTriangle, Layers, Info, Filter } from 'lucide-react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { api } from '../services/api';
import { AIInsight } from '../types';

export const AIInsightsPage: React.FC = () => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const data = await api.getAIInsights();
      setInsights(data);
    } catch (err) {
      console.error('Failed to load AI insights', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = insights.filter((ins) => {
    if (selectedFilter === 'ALL') return true;
    return ins.type.toUpperCase() === selectedFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              Explainable AI Intelligence & Rationale
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Real-time explainability extracted directly from the priority scoring engine and CP-SAT constraint solver.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs">
          {['ALL', 'PRIORITY', 'GROUPING', 'CONFLICT', 'RECOMMENDATION'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedFilter(cat)}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${selectedFilter === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((ins, idx) => (
          <Card
            key={idx}
            className="p-5 hover:border-slate-700/80 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Badge
                  variant={
                    ins.severity === 'critical'
                      ? 'critical'
                      : ins.type === 'grouping'
                        ? 'purple'
                        : ins.type === 'conflict'
                          ? 'warning'
                          : 'info'
                  }
                  size="sm"
                >
                  {ins.type.toUpperCase()}
                </Badge>
                {ins.related_section && (
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    {ins.related_section}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-200 leading-relaxed mt-2">{ins.message}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>
                {ins.related_task && `Task: ${ins.related_task}`}
                {ins.related_asset && ` &bull; Asset: ${ins.related_asset}`}
              </span>
              <span className="text-emerald-400">Validated</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
