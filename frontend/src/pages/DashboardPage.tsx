import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Layers,
  Clock,
  TrendingUp,
  ShieldAlert,
  Zap,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Search,
  Radar,
  CalendarCheck,
  CheckCircle2,
  Wrench,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { EChartComponent } from '../components/EChartComponent';
import { api } from '../services/api';
import {
  AnalyticsSummary,
  AIInsight,
  BlockPlan,
  AssetDetection,
  DetectionSummary,
  ScanResult,
} from '../types';
import { NavTab } from '../components/Sidebar';

interface DashboardPageProps {
  onNavigate: (tab: NavTab) => void;
  onRunOptimization: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onRunOptimization,
}) => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [recentPlans, setRecentPlans] = useState<BlockPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active Maintenance Detection State
  const [activeDetections, setActiveDetections] = useState<AssetDetection[]>([]);
  const [detectionSummary, setDetectionSummary] = useState<DetectionSummary | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [schedulingAssetCode, setSchedulingAssetCode] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [sumData, insightData, plansData, detSummary, activeDets] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getAIInsights(),
        api.getBlockPlans({ plan_type: 'optimized' }),
        api.getDetectionSummary(),
        api.getActiveMaintenanceDetection(),
      ]);
      setSummary(sumData);
      setInsights(insightData.slice(0, 4));
      setRecentPlans(plansData.slice(0, 5));
      setDetectionSummary(detSummary);
      setActiveDetections(activeDets);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  // Run simulated asset health scan with realistic phase steps
  const handleRunHealthScan = async () => {
    setIsScanning(true);
    const steps = [
      'Scanning 28 corridor assets on Tamil Nadu Chennai-Salem mainline...',
      'Analyzing condition scores and degradation rates...',
      'Checking scheduled due dates & overdue thresholds...',
      'Cross-referencing historical downtime & defect severity...',
      'Detecting active maintenance requirements and syncing task queue...',
    ];

    for (let i = 0; i < steps.length; i++) {
      setScanStep(steps[i]);
      await new Promise((r) => setTimeout(r, 450));
    }

    try {
      const scanResult: ScanResult = await api.runMaintenanceScan();
      setDetectionSummary(scanResult.summary);
      setActiveDetections(scanResult.active_detections);
      // Also refresh main analytics & tasks
      const sumData = await api.getAnalyticsSummary();
      setSummary(sumData);
      setHasScanned(true);
    } catch (err) {
      console.error('Failed to run maintenance scan', err);
    } finally {
      setIsScanning(false);
      setScanStep('');
    }
  };

  // Direct flow: Asset Detection -> Task -> Planning Workflow
  const handleScheduleMaintenance = async (asset: AssetDetection) => {
    setSchedulingAssetCode(asset.asset_code);
    try {
      // If task wasn't generated yet, run scan to ensure task exists
      if (!asset.existing_task_id) {
        await api.runMaintenanceScan();
      }
      // Re-calculate priorities
      await api.computePriorities();
      // Navigate directly to the Block Planner centerpiece
      onNavigate('planner');
    } catch (err) {
      console.error('Error initiating schedule workflow', err);
    } finally {
      setSchedulingAssetCode(null);
    }
  };

  // Maintenance Status Distribution Chart
  const statusChartOption: any = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#0f172a',
      borderColor: '#1e293b',
      textStyle: { color: '#f8fafc' },
    },
    legend: {
      bottom: '0%',
      left: 'center',
      textStyle: { color: '#94a3b8', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        name: 'Asset Health Status',
        type: 'pie',
        radius: ['52%', '78%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#0f172a',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            fontWeight: 'bold',
            color: '#f8fafc',
          },
        },
        data: detectionSummary
          ? [
            { value: detectionSummary.critical_assets, name: 'CRITICAL', itemStyle: { color: '#ef4444' } },
            { value: detectionSummary.overdue_assets, name: 'OVERDUE', itemStyle: { color: '#f97316' } },
            { value: detectionSummary.maintenance_due, name: 'DUE', itemStyle: { color: '#f59e0b' } },
            { value: detectionSummary.monitor_assets, name: 'MONITOR', itemStyle: { color: '#06b6d4' } },
            { value: detectionSummary.healthy_assets, name: 'HEALTHY', itemStyle: { color: '#10b981' } },
          ]
          : [],
      },
    ],
  };

  // Department workload chart option
  const deptChartOption: any = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#0f172a',
      borderColor: '#1e293b',
      textStyle: { color: '#f8fafc' },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['Engineering (ENG)', 'Traction Dist. (TD)', 'Signaling (S&T)'],
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    series: [
      {
        name: 'Assets',
        type: 'bar',
        data: summary
          ? [
            summary.assets_by_department.ENG || 0,
            summary.assets_by_department.TD || 0,
            summary.assets_by_department.SNT || 0,
          ]
          : [],
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Maintenance Tasks',
        type: 'bar',
        data: summary
          ? [
            summary.tasks_by_department.ENG || 0,
            summary.tasks_by_department.TD || 0,
            summary.tasks_by_department.SNT || 0,
          ]
          : [],
        itemStyle: { color: '#06b6d4', borderRadius: [4, 4, 0, 0] },
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-blue-600/10 to-transparent pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="purple" size="sm">
                <Sparkles className="w-3 h-3 mr-1" />
                Active Maintenance Detection Active
              </Badge>
              <Badge variant="default" size="sm">
                Tamil Nadu Mainline (Southern Railway)
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-slate-50 tracking-tight">
              Railway Maintenance Block Optimization Command
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Detecting critical railway component wear, evaluating multi-department constraints, and packing
              maintenance blocks with Google OR-Tools CP-SAT.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('planner')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all"
            >
              <span>Open Block Planner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('analytics')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
            >
              <span>Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* PROMINENT PANEL: ACTIVE MAINTENANCE DETECTION             */}
      {/* ========================================================== */}
      <div className="bg-[#0b1222] border-2 border-blue-900/60 rounded-2xl p-6 shadow-2xl space-y-5 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-red-950/70 border border-red-800/60 text-red-400">
                <Radar className="w-4 h-4 animate-spin-slow" />
              </div>
              <h3 className="text-base font-bold text-slate-100 tracking-tight uppercase">
                Active Maintenance Detection
              </h3>
              <Badge variant="critical" size="sm">
                {detectionSummary ? `${detectionSummary.requiring_maintenance} Active Requirements` : 'Scanning...'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Evaluates condition scores, overdue days, criticality, and availability thresholds to detect track,
              signal, and OHE intervention requirements.
            </p>
          </div>

          {/* Action: Run Asset Health Scan */}
          <button
            onClick={handleRunHealthScan}
            disabled={isScanning}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all shrink-0 ${isScanning
                ? 'bg-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-red-500/25 active:scale-98'
              }`}
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Scan...</span>
              </>
            ) : (
              <>
                <Radar className="w-4 h-4" />
                <span>Run Asset Health Scan</span>
              </>
            )}
          </button>
        </div>

        {/* Scan Status Banner during scan */}
        {isScanning && (
          <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-700/60 flex items-center gap-3 text-xs text-cyan-300 font-mono animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-cyan-400" />
            <span>{scanStep}</span>
          </div>
        )}

        {/* Health Status Bar Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Assets</span>
            <div className="text-xl font-bold text-slate-100 font-mono mt-1">
              {detectionSummary ? detectionSummary.total_assets : '--'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/60 shadow-[0_0_12px_rgba(239,68,68,0.15)]">
            <span className="text-[10px] uppercase tracking-wider text-red-400 font-bold">CRITICAL</span>
            <div className="text-xl font-bold text-red-400 font-mono mt-1">
              {detectionSummary ? detectionSummary.critical_assets : '--'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-orange-950/40 border border-orange-900/60">
            <span className="text-[10px] uppercase tracking-wider text-orange-400 font-bold">OVERDUE</span>
            <div className="text-xl font-bold text-orange-400 font-mono mt-1">
              {detectionSummary ? detectionSummary.overdue_assets : '--'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-900/60">
            <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">DUE SOON</span>
            <div className="text-xl font-bold text-amber-300 font-mono mt-1">
              {detectionSummary ? detectionSummary.maintenance_due : '--'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-900/60">
            <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold">MONITOR</span>
            <div className="text-xl font-bold text-cyan-400 font-mono mt-1">
              {detectionSummary ? detectionSummary.monitor_assets : '--'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60">
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">HEALTHY</span>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
              {detectionSummary ? detectionSummary.healthy_assets : '--'}
            </div>
          </div>
        </div>

        {/* Detected Active Maintenance Asset Cards */}
        {hasScanned && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Active Detected Maintenance Requirements ({activeDetections.length})
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              Ordered by Detection Severity Score
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeDetections.slice(0, 6).map((asset) => (
              <div
                key={asset.asset_id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${asset.maintenance_status === 'CRITICAL'
                    ? 'bg-gradient-to-br from-red-950/40 to-slate-900 border-red-800/80 shadow-lg shadow-red-950/30'
                    : asset.maintenance_status === 'OVERDUE'
                      ? 'bg-gradient-to-br from-orange-950/40 to-slate-900 border-orange-800/80'
                      : 'bg-gradient-to-br from-amber-950/40 to-slate-900 border-amber-800/70'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge
                      variant={
                        asset.maintenance_status === 'CRITICAL'
                          ? 'critical'
                          : asset.maintenance_status === 'OVERDUE'
                            ? 'warning'
                            : 'high'
                      }
                      size="sm"
                    >
                      {asset.maintenance_status}
                    </Badge>
                    <div className="text-[11px] font-mono font-bold text-cyan-400">
                      Score: {asset.detection_score}/100
                    </div>
                  </div>

                  <div className="font-bold text-sm text-slate-100 mb-0.5">
                    {asset.asset_type} {asset.asset_code}
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-1">{asset.name}</p>

                  <div className="mt-3 grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[10px] font-mono">
                    <div>
                      <span className="text-slate-400">Cond:</span>{' '}
                      <strong
                        className={
                          asset.condition_score < 40
                            ? 'text-red-400'
                            : asset.condition_score < 60
                              ? 'text-amber-400'
                              : 'text-slate-200'
                        }
                      >
                        {asset.condition_score}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Avail:</span>{' '}
                      <strong className="text-emerald-400">{asset.availability}%</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Sec:</span>{' '}
                      <strong className="text-slate-200 truncate">{asset.section_code}</strong>
                    </div>
                  </div>

                  {/* Reasons list */}
                  <div className="mt-3 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">Detection Rationale:</div>
                    {asset.reasons.slice(0, 2).map((r: any, i: number) => (
                      <div key={i} className="text-[11px] text-slate-300 leading-snug flex items-start gap-1.5">
                        <span className="text-red-400 shrink-0">&bull;</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Schedule Maintenance Action */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {asset.existing_task_code ? `Task: ${asset.existing_task_code}` : 'New detected need'}
                  </span>
                  <button
                    onClick={() => handleScheduleMaintenance(asset)}
                    disabled={schedulingAssetCode === asset.asset_code}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                  >
                    {schedulingAssetCode === asset.asset_code ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <CalendarCheck className="w-3 h-3" />
                    )}
                    <span>Schedule Maintenance &rarr;</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Corridor Asset Availability"
          value={summary ? summary.asset_availability : '--'}
          unit="%"
          change="+4.8% vs unoptimized"
          changeType="positive"
          icon={<Activity className="w-5 h-5" />}
          accentColor="emerald"
          subtext="across 28 assets"
        />
        <StatCard
          title="Optimized Blocks"
          value={summary ? summary.optimized_blocks : '--'}
          unit="blocks"
          change={`${summary ? summary.integrated_blocks : 0} integrated`}
          changeType="positive"
          icon={<Layers className="w-5 h-5" />}
          accentColor="cyan"
          subtext="multi-department sharing"
        />
        <StatCard
          title="Estimated Train Disruption"
          value={summary ? summary.train_disruption_hours : '--'}
          unit="hours"
          change="-68% vs baseline"
          changeType="positive"
          icon={<Clock className="w-5 h-5" />}
          accentColor="amber"
          subtext="lean passenger slots"
        />
        <StatCard
          title="Pending / Critical Maintenance"
          value={summary ? `${summary.critical_maintenance} / ${summary.pending_maintenance}` : '--'}
          change="Prioritized by AI"
          changeType="neutral"
          icon={<AlertTriangle className="w-5 h-5" />}
          accentColor="rose"
          subtext="35 total active requests"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset Condition Distribution */}
        <Card title="Asset Health Status Breakdown" subtitle="CRITICAL, OVERDUE, DUE, MONITOR, and HEALTHY">
          <EChartComponent option={statusChartOption} style={{ height: '240px', width: '100%' }} />
        </Card>

        {/* Department Workload */}
        <Card
          title="Department Workload & Maintenance Tasks"
          subtitle="Engineering vs Traction Distribution vs S&T"
          className="lg:col-span-2"
        >
          <EChartComponent option={deptChartOption} style={{ height: '240px', width: '100%' }} />
        </Card>
      </div>

      {/* Bottom Row: AI Insights Preview & Recent Optimized Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights */}
        <Card
          title="Recent Explainable AI Insights"
          subtitle="Real-time reasoning from priority & constraint validation engine"
          action={
            <button
              onClick={() => onNavigate('analytics')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          }
        >
          <div className="space-y-3">
            {insights.map((ins, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start gap-3"
              >
                <div className="mt-0.5 shrink-0">
                  {ins.severity === 'critical' ? (
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                  ) : ins.type === 'grouping' ? (
                    <Zap className="w-4 h-4 text-purple-400" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge
                      variant={
                        ins.severity === 'critical'
                          ? 'critical'
                          : ins.type === 'grouping'
                            ? 'purple'
                            : 'info'
                      }
                      size="sm"
                    >
                      {ins.type.toUpperCase()}
                    </Badge>
                    {ins.related_section && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Sec: {ins.related_section}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{ins.message}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Optimized Blocks */}
        <Card
          title="Active Optimized Maintenance Blocks"
          subtitle="Generated via Google OR-Tools CP-SAT solver"
          action={
            <button
              onClick={() => onNavigate('planner')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              Open Planner <ArrowRight className="w-3 h-3" />
            </button>
          }
        >
          <div className="space-y-3">
            {recentPlans.map((plan) => (
              <div
                key={plan.id}
                className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-10 rounded-full shrink-0 ${plan.is_integrated ? 'bg-purple-500' : 'bg-blue-500'
                      }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-100">
                        {plan.section_code || 'Mainline'}
                      </span>
                      {plan.is_integrated ? (
                        <Badge variant="purple" size="sm">
                          INTEGRATED BLOCK
                        </Badge>
                      ) : (
                        <Badge variant="info" size="sm">
                          STANDARD
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>{plan.plan_date}</span>
                      <span>&bull;</span>
                      <span>
                        {plan.window_start ? plan.window_start.slice(0, 5) : '10:00'} -{' '}
                        {plan.window_end ? plan.window_end.slice(0, 5) : '12:00'}
                      </span>
                      <span>&bull;</span>
                      <span className="text-slate-300">
                        {plan.block_tasks.length} tasks scheduled
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-semibold text-emerald-400">
                    Score: {plan.optimization_score}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Disruption: {plan.train_disruption_minutes}m
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
