import React, { useState, useEffect } from 'react';
import { CalendarDays, Clock, Zap, Layers, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { api } from '../services/api';
import { WeeklyPlan, DayPlan, BlockPlan } from '../types';

export const WeeklyPlanPage: React.FC = () => {
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activePlanType, setActivePlanType] = useState<string>('optimized');

  useEffect(() => {
    loadWeeklyPlan();
  }, [activePlanType]);

  const loadWeeklyPlan = async () => {
    setLoading(true);
    try {
      const data = await api.getWeeklyPlan(activePlanType);
      setWeeklyPlan(data);
    } catch (err) {
      console.error('Failed to load weekly plan', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <CalendarDays className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              Weekly Maintenance Block Schedule
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Automated Gantt schedule view across all days of the operational week.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setActivePlanType('optimized')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activePlanType === 'optimized'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              OR-Tools Optimized
            </button>
            <button
              onClick={() => setActivePlanType('baseline')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activePlanType === 'baseline'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Baseline Heuristic
            </button>
          </div>
        </div>
      </div>

      {/* Weekly Summary Bar */}
      {weeklyPlan && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400">Total Weekly Blocks</span>
            <div className="text-xl font-bold text-slate-100 mt-1">
              {weeklyPlan.summary.total_blocks}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400">Integrated Blocks</span>
            <div className="text-xl font-bold text-purple-400 mt-1">
              {weeklyPlan.summary.integrated_blocks}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400">Total Tasks Scheduled</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {weeklyPlan.summary.total_tasks}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400">Total Corridor Block Time</span>
            <div className="text-xl font-bold text-cyan-400 mt-1">
              {weeklyPlan.summary.total_block_hours} hrs
            </div>
          </div>
        </div>
      )}

      {/* Gantt-style Timeline per Day */}
      <div className="space-y-4">
        {weeklyPlan?.days.map((day) => (
          <Card key={day.date} className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 mb-3 border-b border-slate-800/80 gap-2">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span className="text-sm font-bold text-slate-100">{day.day_name}</span>
                <span className="text-xs font-mono text-slate-400">({day.date})</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>
                  <strong className="text-slate-200">{day.blocks.length}</strong> blocks scheduled
                </span>
                <span>&bull;</span>
                <span>
                  <strong className="text-slate-200">{day.total_tasks}</strong> maintenance tasks
                </span>
                <span>&bull;</span>
                <span>
                  <strong className="text-slate-200">{day.total_block_hours}</strong> hours
                </span>
              </div>
            </div>

            {day.blocks.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500 italic">
                No maintenance blocks scheduled on this day (free corridor movement).
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {day.blocks.map((block) => (
                  <div
                    key={block.id}
                    className={`p-3.5 rounded-xl border text-xs transition-all ${
                      block.is_integrated
                        ? 'bg-purple-950/20 border-purple-800/50 hover:border-purple-600'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-100">{block.section_code}</div>
                        <div className="text-[11px] font-mono text-cyan-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {block.window_start ? block.window_start.slice(0, 5) : '10:00'} -{' '}
                            {block.window_end ? block.window_end.slice(0, 5) : '12:00'}
                          </span>
                        </div>
                      </div>

                      {block.is_integrated ? (
                        <Badge variant="purple" size="sm">
                          <Zap className="w-3 h-3 mr-1" />
                          INTEGRATED
                        </Badge>
                      ) : (
                        <Badge variant="info" size="sm">
                          STANDARD
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1 mt-2.5">
                      <span className="text-[10px] text-slate-400">Depts:</span>
                      {block.departments_involved.map((dept, i) => (
                        <span
                          key={i}
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          {dept}
                        </span>
                      ))}
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-300 space-y-1">
                      {block.block_tasks.map((bt) => (
                        <div key={bt.id} className="flex justify-between font-mono text-[10px]">
                          <span className="font-semibold text-slate-200">{bt.task_code}</span>
                          <span className="text-slate-400 truncate max-w-[130px]">
                            {bt.task_description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
