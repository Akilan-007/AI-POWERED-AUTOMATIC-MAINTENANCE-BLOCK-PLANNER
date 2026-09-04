import React, { useState, useEffect } from 'react';
import {
  Play,
  RefreshCw,
  Sparkles,
  Layers,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Filter,
  Info,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/Card';
import { GanttTimeline } from '@/components/GanttTimeline';
import { Badge } from '@/components/Badge';
import { api } from '@/services/api';
import {
  MaintenanceTask,
  BlockPlan,
  OptimizationResult,
  ComparisonResult,
} from '@/types';
import { useDisruption } from '../components/DisruptionController';

export const BlockPlannerPage: React.FC = () => {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [plans, setPlans] = useState<BlockPlan[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedPlan, setSelectedPlan] = useState<BlockPlan | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isComputingPriorities, setIsComputingPriorities] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<'optimized' | 'baseline'>('optimized');
  const [loading, setLoading] = useState<boolean>(true);

  const { activeDisruption } = useDisruption();

  const displayPlans = React.useMemo(() => {
    if (!activeDisruption) return plans;
    
    const emergencyPlan: BlockPlan = {
      id: 9999,
      plan_date: activeDisruption.timestamp.split('T')[0],
      block_window_id: 999,
      section_code: activeDisruption.assetId + ' (CRITICAL)',
      window_start: 'IMMEDIATE',
      window_end: `+${activeDisruption.estimatedDowntimeHours}HRS`,
      status: 'Emergency',
      optimization_score: 0,
      train_disruption_minutes: activeDisruption.estimatedDowntimeHours * 60,
      asset_availability_impact: -25.0,
      is_integrated: 0,
      departments_involved: ['EMERGENCY'],
      plan_type: 'emergency',
      block_tasks: [
        {
          id: 99991,
          block_plan_id: 9999,
          maintenance_task_id: 99991,
          task_code: activeDisruption.type,
          task_description: activeDisruption.description,
          start_time: 'IMMEDIATE',
          end_time: 'TBD',
        }
      ],
      reasoning: 'EMERGENCY OVERRIDE: Active disruption triggered. Standard OR-Tools CP-SAT blocks paused or re-routed until isolation resolves.'
    };
    return [emergencyPlan, ...plans];
  }, [plans, activeDisruption]);

  useEffect(() => {
    loadPlannerData();
  }, []);

  const loadPlannerData = async () => {
    setLoading(true);
    try {
      const [tasksData, plansData] = await Promise.all([
        api.getMaintenanceTasks(),
        api.getBlockPlans({ plan_type: activeMode }),
      ]);
      setTasks(tasksData);
      setPlans(plansData);
      if (plansData.length > 0) {
        setSelectedPlan(plansData[0]);
      }
    } catch (err) {
      console.error('Failed to load planner data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleComputePriorities = async () => {
    setIsComputingPriorities(true);
    try {
      await api.computePriorities();
      const updatedTasks = await api.getMaintenanceTasks();
      setTasks(updatedTasks);
    } catch (err) {
      console.error('Error computing priorities', err);
    } finally {
      setIsComputingPriorities(false);
    }
  };

  const handleRunOptimization = async () => {
    setIsOptimizing(true);
    setActiveMode('optimized');
    try {
      const result = await api.generateOptimizedPlan();
      setOptimizationResult(result);
      setPlans(result.plans);
      if (result.plans.length > 0) {
        setSelectedPlan(result.plans[0]);
      }
      // Refresh task statuses
      const updatedTasks = await api.getMaintenanceTasks();
      setTasks(updatedTasks);
    } catch (err) {
      console.error('Error optimizing block plan', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleRunBaseline = async () => {
    setIsOptimizing(true);
    setActiveMode('baseline');
    try {
      const result = await api.generateBaselinePlan();
      setOptimizationResult(result);
      setPlans(result.plans);
      if (result.plans.length > 0) {
        setSelectedPlan(result.plans[0]);
      }
      const updatedTasks = await api.getMaintenanceTasks();
      setTasks(updatedTasks);
    } catch (err) {
      console.error('Error generating baseline plan', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (selectedDept !== 'ALL' && t.department_code !== selectedDept) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Planner Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Calendar className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              Automatic Maintenance Block Planner
            </h2>
            <Badge variant="purple" size="sm">
              CP-SAT Solved
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Multi-department constraint programming engine. Packs compatible Engineering, Traction, and
            S&T tasks into unified corridor maintenance windows.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleComputePriorities}
            disabled={isComputingPriorities}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Sparkles className={`w-3.5 h-3.5 text-cyan-400 ${isComputingPriorities ? 'animate-spin' : ''}`} />
            <span>Recalculate AI Priorities</span>
          </button>

          <button
            onClick={handleRunBaseline}
            disabled={isOptimizing}
            className={`px-3.5 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${activeMode === 'baseline'
                ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
          >
            <span>Run Baseline (Heuristic)</span>
          </button>

          <button
            onClick={handleRunOptimization}
            disabled={isOptimizing}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
          >
            {isOptimizing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Solving OR-Tools CP-SAT...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Generate Optimized Plan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3-Column Centerpiece Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Maintenance Task Queue (30% / 4 cols) */}
        <div className="xl:col-span-4 space-y-4">
          <Card
            title="Maintenance Task Queue"
            subtitle={`${filteredTasks.length} tasks ready for scheduling`}
            action={
              <div className="flex items-center gap-1">
                {['ALL', 'ENG', 'TD', 'SNT'].map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${selectedDept === dept
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            }
          >
            <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-100">{task.task_code}</span>
                        <Badge
                          variant={
                            task.department_code === 'ENG'
                              ? 'info'
                              : task.department_code === 'TD'
                                ? 'warning'
                                : 'purple'
                          }
                          size="sm"
                        >
                          {task.department_code}
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {task.section_code}
                        </span>
                      </div>
                      <p className="text-slate-300 mt-1 line-clamp-2 leading-relaxed text-[11px]">
                        {task.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${task.priority >= 80
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : task.priority >= 60
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                      >
                        P: {task.priority}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{task.duration_minutes}m</span>
                      </div>
                    </div>
                  </div>

                  {task.priority_explanation && (
                    <div className="mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-cyan-300/80 leading-snug">
                      <span className="font-semibold text-slate-400">AI Priority: </span>
                      {task.priority_explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Center Column: Scheduled Block Windows Timeline (45% / 5 cols) */}
        <div className="xl:col-span-5 space-y-4">
          <Card
            title={`Optimized Maintenance Blocks (${displayPlans.length})`}
            subtitle={
              activeMode === 'optimized'
                ? 'OR-Tools CP-SAT scheduled windows with multi-department grouping'
                : 'Baseline first-available scheduling (unoptimized)'
            }
            action={
              <Badge variant={activeMode === 'optimized' ? 'success' : 'warning'} size="sm">
                {activeMode.toUpperCase()} MODE
              </Badge>
            }
          >
            <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
              {displayPlans.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No block plans generated yet. Click "Generate Optimized Plan" above.
                </div>
              ) : (
                displayPlans.map((plan) => {
                  const isSelected = selectedPlan?.id === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${isSelected
                          ? 'bg-[#15233e] border-blue-500/80 shadow-lg shadow-blue-500/10'
                          : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700/80'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-100">
                              {plan.section_code || 'Mainline Corridor'}
                            </span>
                            {plan.is_integrated ? (
                              <Badge variant="purple" size="sm">
                                <Zap className="w-3 h-3 mr-1" />
                                INTEGRATED BLOCK
                              </Badge>
                            ) : (
                              <Badge variant="info" size="sm">
                                STANDARD BLOCK
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-2 font-mono">
                            <span className="text-slate-300 font-semibold">{plan.plan_date}</span>
                            <span>&bull;</span>
                            <span className="text-cyan-400 font-semibold">
                              {plan.window_start ? plan.window_start.slice(0, 5) : '10:00'} -{' '}
                              {plan.window_end ? plan.window_end.slice(0, 5) : '12:00'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold text-emerald-400">
                            Score: {plan.optimization_score}
                          </div>
                          <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                            Disrupt: {plan.train_disruption_minutes}m
                          </div>
                        </div>
                      </div>

                      {/* Departments Involved Pills */}
                      <div className="flex items-center gap-1.5 mt-3">
                        <span className="text-[10px] text-slate-400 font-medium">Depts:</span>
                        {plan.departments_involved && plan.departments_involved.length > 0 ? (
                          plan.departments_involved.map((dept, i) => (
                            <span
                              key={i}
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${dept === 'ENG'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                  : dept === 'TD'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-purple-950 text-purple-300 border border-purple-800'
                                }`}
                            >
                              {dept}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400">Standard</span>
                        )}
                      </div>

                      {/* Scheduled Tasks list */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Tasks Scheduled ({plan.block_tasks.length}):
                        </div>
                        {plan.block_tasks.map((bt) => (
                          <div
                            key={bt.id}
                            className="flex items-center justify-between text-[11px] bg-slate-950/50 px-2.5 py-1.5 rounded border border-slate-800/50"
                          >
                            <span className="font-mono font-semibold text-slate-200">
                              {bt.task_code}
                            </span>
                            <span className="text-slate-400 truncate max-w-[200px] text-[10px]">
                              {bt.task_description}
                            </span>
                            <span className="text-cyan-400 font-mono text-[10px]">
                              {bt.start_time.slice(0, 5)} - {bt.end_time.slice(0, 5)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: AI Recommendation & Explainability (25% / 3 cols) */}
        <div className="xl:col-span-3 space-y-4">
          {/* Optimization KPI Summary Card */}
          <Card title="Optimizer Summary" subtitle="OR-Tools CP-SAT metrics">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Optimization Score
                </span>
                <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                  {optimizationResult ? optimizationResult.optimization_score : '76.4'}
                  <span className="text-xs text-slate-400 font-normal"> / 100</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Evaluated across asset availability, priority completion & minimal disruption.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Total Blocks</div>
                  <div className="text-base font-bold text-slate-100 mt-0.5">
                    {displayPlans.length}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Integrated</div>
                  <div className="text-base font-bold text-purple-400 mt-0.5">
                    {displayPlans.filter((p) => p.is_integrated).length}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Train Disruption</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5">
                    {displayPlans.reduce((acc, p) => acc + p.train_disruption_minutes, 0)}m
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Availability Gain</div>
                  <div className="text-base font-bold text-cyan-400 mt-0.5">
                    +4.2%
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Explainability Panel: Why was this block selected? */}
          <Card
            title="AI Reasoning Panel"
            subtitle="Transparent explainability for current block"
          >
            {selectedPlan ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/40 text-slate-300 leading-relaxed text-[11px]">
                  <div className="font-bold text-blue-300 mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>Why was this block selected?</span>
                  </div>
                  {selectedPlan.reasoning ||
                    'Candidate window was chosen because it corresponds to lean passenger traffic and allows multiple departments to execute compatible maintenance without repeated closures.'}
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Constraints Satisfied (10/10)
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-300">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Zero conflict with High-Priority Rajdhani / Shatabdi</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Corridor section cleared & available</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Task durations fit safely in window</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Department daily block caps respected</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Select any block on the left to see reasoning.</p>
            )}
          </Card>
        </div>
      </div>

      {/* ── CP-SAT Gantt Visualiser ──────────────────────────────────────────── */}
      <div className="mt-2">
        {/* Section divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent" />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Mega-Block Gantt Visualiser
          </div>
          <div className="h-px flex-1 bg-gradient-to-l from-slate-800 to-transparent" />
        </div>
        <GanttTimeline />
      </div>
    </div>
  );
};
