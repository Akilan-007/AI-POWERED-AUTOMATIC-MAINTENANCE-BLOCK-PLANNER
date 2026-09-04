import React, { useState, useEffect } from 'react';
import { CalendarRange, Layers, CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { Card } from '../components/Card';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { api } from '../services/api';
import { MonthlyPlan } from '../types';

export const MonthlyPlanPage: React.FC = () => {
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadMonthlyPlan();
  }, []);

  const loadMonthlyPlan = async () => {
    setLoading(true);
    try {
      const data = await api.getMonthlyPlan();
      setMonthlyPlan(data);
    } catch (err) {
      console.error('Failed to load monthly plan', err);
    } finally {
      setLoading(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonthName = monthlyPlan ? monthNames[monthlyPlan.month - 1] : 'September';

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <CalendarRange className="w-4 h-4" />
          </span>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Monthly Planning & Asset Projection
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Monthly maintenance block volume, integrated efficiency, and projected rail asset availability for {currentMonthName} {monthlyPlan?.year || 2026}.
        </p>
      </div>

      {/* Monthly KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Monthly Maintenance"
          value={monthlyPlan ? monthlyPlan.total_tasks : '--'}
          unit="tasks"
          icon={<CalendarRange className="w-5 h-5" />}
          accentColor="blue"
          subtext="across all 3 departments"
        />
        <StatCard
          title="Projected Asset Availability"
          value={monthlyPlan ? monthlyPlan.estimated_availability : '--'}
          unit="%"
          change="+5.2% target"
          changeType="positive"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accentColor="emerald"
          subtext="maintained at >85% SLA"
        />
        <StatCard
          title="Integrated Maintenance Blocks"
          value={monthlyPlan ? `${monthlyPlan.integrated_blocks} / ${monthlyPlan.total_blocks}` : '--'}
          change="~70% shared corridor"
          changeType="positive"
          icon={<Layers className="w-5 h-5" />}
          accentColor="purple"
          subtext="multi-department sharing"
        />
        <StatCard
          title="Projected Train Disruption"
          value={monthlyPlan ? monthlyPlan.estimated_disruption : '--'}
          unit="hours"
          change="-45% vs manual plan"
          changeType="positive"
          icon={<Clock className="w-5 h-5" />}
          accentColor="amber"
          subtext="lean passenger slots"
        />
      </div>

      {/* Monthly Planning Table / Calendar Overview */}
      <Card
        title={`${currentMonthName} 2026 Maintenance Projection`}
        subtitle="Weekly batch allocation and corridor occupancy forecast"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            {['Week 1 (Current)', 'Week 2 (Forecast)', 'Week 3 (Forecast)', 'Week 4 (Forecast)'].map(
              (wk, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border ${
                    idx === 0
                      ? 'bg-blue-950/30 border-blue-800/80 shadow-md shadow-blue-500/10'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-100">{wk}</span>
                    {idx === 0 && (
                      <Badge variant="success" size="sm">
                        ACTIVE
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2 text-slate-300 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Planned Blocks:</span>
                      <span className="font-bold">{idx === 0 ? monthlyPlan?.total_blocks || 14 : 12 - idx}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Integrated Blocks:</span>
                      <span className="text-purple-400 font-bold">{idx === 0 ? monthlyPlan?.integrated_blocks || 10 : 8}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Disruption:</span>
                      <span className="text-amber-400">{(20 - idx * 2).toFixed(1)} hrs</span>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
