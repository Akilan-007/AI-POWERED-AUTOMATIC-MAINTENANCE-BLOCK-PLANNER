import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Wrench,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Info,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { api } from '../services/api';
import { MaintenanceTask, CandidateWindow } from '../types';

export const MaintenanceTasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedCriticality, setSelectedCriticality] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeTask, setActiveTask] = useState<MaintenanceTask | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await api.getMaintenanceTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load maintenance tasks', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (selectedDept !== 'ALL' && t.department_code !== selectedDept) return false;
    if (selectedCriticality !== 'ALL' && t.criticality !== selectedCriticality) return false;
    if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
    if (search) {
      const query = search.toLowerCase();
      const matchCode = t.task_code.toLowerCase().includes(query);
      const matchAsset = t.asset_code?.toLowerCase().includes(query);
      const matchDesc = t.description.toLowerCase().includes(query);
      if (!matchCode && !matchAsset && !matchDesc) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Maintenance Tasks</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Engineering, Traction Distribution, and S&T maintenance backlog & schedules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            Showing <strong className="text-slate-100">{filteredTasks.length}</strong> of{' '}
            {tasks.length} tasks
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by task code, asset, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Dept:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Departments</option>
              <option value="ENG">Engineering (ENG)</option>
              <option value="TD">Traction Dist. (TD)</option>
              <option value="SNT">Signaling & Telecom (S&T)</option>
            </select>
          </div>

          {/* Criticality Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Criticality:</span>
            <select
              value={selectedCriticality}
              onChange={(e) => setSelectedCriticality(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Criticality</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Overdue">Overdue</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Task Code</th>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Dept</th>
                <th className="py-3 px-4">Section</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">AI Priority</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTasks.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setActiveTask(t)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-200">
                    {t.task_code}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-200">{t.asset_code}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                      {t.asset_name}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        t.department_code === 'ENG'
                          ? 'info'
                          : t.department_code === 'TD'
                          ? 'warning'
                          : 'purple'
                      }
                      size="sm"
                    >
                      {t.department_code}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">{t.section_code}</td>
                  <td className="py-3 px-4 text-slate-300 flex items-center gap-1 mt-3">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t.duration_minutes}m</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                          t.priority >= 80
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : t.priority >= 60
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {t.priority}
                      </span>
                      <span className="text-[10px] text-slate-400">{t.criticality}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">{t.due_date}</td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        t.status === 'Scheduled'
                          ? 'success'
                          : t.status === 'Overdue'
                          ? 'critical'
                          : 'default'
                      }
                      size="sm"
                    >
                      {t.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                      Inspect &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Task Details Drawer/Modal */}
      {activeTask && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button
              onClick={() => setActiveTask(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <span className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Wrench className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {activeTask.task_code}: {activeTask.description}
                </h3>
                <p className="text-xs text-slate-400">
                  Asset {activeTask.asset_code} &bull; Section {activeTask.section_code}
                </p>
              </div>
            </div>

            {/* AI Priority Card */}
            <div className="my-4 p-4 rounded-xl bg-blue-950/40 border border-blue-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200">
                    AI Priority Scoring & Reasoning
                  </span>
                </div>
                <div className="text-base font-bold font-mono text-cyan-400">
                  Score: {activeTask.priority}/100
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeTask.priority_explanation ||
                  'Score synthesized from asset criticality, historical failure rate, days overdue, and corridor traffic sensitivity.'}
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Department</span>
                <div className="font-semibold text-slate-200 mt-1">
                  {activeTask.department_name} ({activeTask.department_code})
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Duration</span>
                <div className="font-semibold text-slate-200 mt-1">
                  {activeTask.duration_minutes} Minutes
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Urgency</span>
                <div className="font-semibold text-slate-200 mt-1">{activeTask.urgency}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Due Date</span>
                <div className="font-semibold font-mono text-slate-200 mt-1">
                  {activeTask.due_date}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveTask(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
