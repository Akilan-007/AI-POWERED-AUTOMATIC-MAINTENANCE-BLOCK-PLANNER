import React from 'react';
import {
  LayoutDashboard,
  Wrench,
  Cpu,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Network,
  Sparkles,
  SlidersHorizontal,
  BarChart3,
  Train,
  ShieldCheck,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'tasks'
  | 'assets'
  | 'planner'
  | 'weekly'
  | 'monthly'
  | 'network'
  | 'insights'
  | 'simulation'
  | 'analytics';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  pendingTasksCount?: number;
  criticalCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingTasksCount = 0,
  criticalCount = 0,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'planner' as NavTab,
      label: 'Block Planner',
      icon: CalendarCheck,
      highlight: true,
      badge: 'CP-SAT',
    },
    {
      id: 'tasks' as NavTab,
      label: 'Maintenance Tasks',
      icon: Wrench,
      count: pendingTasksCount,
    },
    { id: 'assets' as NavTab, label: 'Assets & Availability', icon: Cpu },
    { id: 'weekly' as NavTab, label: 'Weekly Schedule', icon: CalendarDays },
    { id: 'monthly' as NavTab, label: 'Monthly Schedule', icon: CalendarRange },
    { id: 'network' as NavTab, label: 'Railway Network', icon: Network },
    {
      id: 'insights' as NavTab,
      label: 'AI Insights',
      icon: Sparkles,
      count: criticalCount,
      countVariant: 'critical',
    },
    { id: 'simulation' as NavTab, label: 'Simulation & What-If', icon: SlidersHorizontal },
    { id: 'analytics' as NavTab, label: 'Analytics & Baseline', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-500/20 text-white">
            <Train className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-slate-100 tracking-tight">RailBlock AI</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
                SIH26027
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Automatic Block Planner</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Operations
        </div>
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                isActive
                  ? item.highlight
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                    : 'bg-slate-800/90 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? (item.highlight ? 'text-white' : 'text-blue-400') : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      item.countVariant === 'critical'
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        <div className="pt-4 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Schedules & Topology
        </div>
        {navItems.slice(4, 7).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-slate-800/90 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}

        <div className="pt-4 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          AI & Decision Intelligence
        </div>
        {navItems.slice(7).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-slate-800/90 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-950 text-amber-300 border border-amber-800">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Prototype & Compliance Footer */}
      <div className="p-3.5 border-t border-slate-800/80 bg-[#080d19]">
        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Decision Support System</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Prototype using Railway Operations Data (Tamil Nadu Corridor — Southern Railway).
          </p>
        </div>
      </div>
    </aside>
  );
};
