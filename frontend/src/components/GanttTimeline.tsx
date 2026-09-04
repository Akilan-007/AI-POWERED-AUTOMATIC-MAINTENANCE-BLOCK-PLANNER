import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Cpu,
  Zap,
  CheckCircle2,
  Clock,
  TrendingDown,
  Layers,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GanttTask {
  id: string;
  label: string;
  dept: 'ENG' | 'TD' | 'SNT';
  /** Baseline start hour (0-24) */
  baselineStart: number;
  /** Baseline duration in hours */
  durationHours: number;
  /** Target (optimized) start hour — they all converge to one window */
  optimizedStart: number;
  color: string;
  glowColor: string;
  borderColor: string;
  trackCode: string;
}

interface SolverStep {
  label: string;
  detail: string;
  duration: number; // ms
}

// ─── Static data (realistic-looking demo tasks) ───────────────────────────────

const TIMELINE_START_HOUR = 0; // midnight
const TIMELINE_END_HOUR = 24;
const TIMELINE_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR;

const DEMO_TASKS: GanttTask[] = [
  {
    id: 't1',
    label: 'Rail Grinding',
    dept: 'ENG',
    baselineStart: 2,
    durationHours: 2.5,
    optimizedStart: 2,
    color: 'from-blue-600/80 to-blue-500/60',
    glowColor: 'rgba(59,130,246,0.45)',
    borderColor: 'border-blue-500/70',
    trackCode: 'CBE-SA1',
  },
  {
    id: 't2',
    label: 'Signalling OHE Check',
    dept: 'SNT',
    baselineStart: 6.5,
    durationHours: 2,
    optimizedStart: 2.5,
    color: 'from-purple-600/80 to-purple-500/60',
    glowColor: 'rgba(168,85,247,0.45)',
    borderColor: 'border-purple-500/70',
    trackCode: 'CBE-SA1',
  },
  {
    id: 't3',
    label: 'Traction Power Inspection',
    dept: 'TD',
    baselineStart: 14,
    durationHours: 2,
    optimizedStart: 3,
    color: 'from-amber-500/80 to-amber-400/60',
    glowColor: 'rgba(245,158,11,0.45)',
    borderColor: 'border-amber-500/70',
    trackCode: 'CBE-SA1',
  },
  {
    id: 't4',
    label: 'Track Geometry Survey',
    dept: 'ENG',
    baselineStart: 9,
    durationHours: 1.5,
    optimizedStart: 2,
    color: 'from-cyan-600/80 to-cyan-500/60',
    glowColor: 'rgba(6,182,212,0.45)',
    borderColor: 'border-cyan-500/70',
    trackCode: 'SA1-ERD',
  },
  {
    id: 't5',
    label: 'Relay Room Inspection',
    dept: 'SNT',
    baselineStart: 18,
    durationHours: 1.5,
    optimizedStart: 3.5,
    color: 'from-violet-600/80 to-violet-500/60',
    glowColor: 'rgba(139,92,246,0.45)',
    borderColor: 'border-violet-500/70',
    trackCode: 'SA1-ERD',
  },
];

const SOLVER_STEPS: SolverStep[] = [
  { label: 'Parsing constraint model…', detail: '47 boolean variables, 23 linear constraints loaded', duration: 700 },
  { label: 'Evaluating feasibility…', detail: 'Checking block window capacity & train conflicts', duration: 900 },
  { label: 'Running branch-and-bound…', detail: 'CP-SAT workers: 8 threads · SCIP backend', duration: 1100 },
  { label: 'Minimising downtime objective…', detail: 'Overlap penalty = 0 · Disruption penalty minimised', duration: 950 },
  { label: 'Generating Mega-Block window…', detail: 'Packing 5 tasks → single 02:00–05:00 corridor closure', duration: 800 },
  { label: 'Validating solution…', detail: 'All constraints satisfied · Score 94.2 / 100', duration: 600 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hourToPercent(hour: number): number {
  return ((hour - TIMELINE_START_HOUR) / TIMELINE_HOURS) * 100;
}

function durationToPercent(hours: number): number {
  return (hours / TIMELINE_HOURS) * 100;
}

function formatHour(h: number): string {
  const whole = Math.floor(h);
  const frac = h - whole;
  const mins = Math.round(frac * 60);
  return `${String(whole).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

const DEPT_COLORS: Record<string, string> = {
  ENG: 'bg-blue-950 text-blue-300 border border-blue-800',
  TD: 'bg-amber-950 text-amber-300 border border-amber-800',
  SNT: 'bg-purple-950 text-purple-300 border border-purple-800',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const DeptPill: React.FC<{ dept: string }> = ({ dept }) => (
  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${DEPT_COLORS[dept] ?? 'bg-slate-800 text-slate-300'}`}>
    {dept}
  </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────

type AnimState = 'idle' | 'solving' | 'done';

export const GanttTimeline: React.FC = () => {
  const [animState, setAnimState] = useState<AnimState>('idle');
  const [solverStepIdx, setSolverStepIdx] = useState<number>(-1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [taskPositions, setTaskPositions] = useState<Record<string, number>>(
    Object.fromEntries(DEMO_TASKS.map((t) => [t.id, t.baselineStart]))
  );
  const [downtimeSaved, setDowntimeSaved] = useState<number>(0);
  const [showMegaBlock, setShowMegaBlock] = useState(false);
  const [pulseMetric, setPulseMetric] = useState(false);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute baseline total track-hours vs optimised
  const baselineTotalHours = DEMO_TASKS.reduce((acc, t) => {
    // Assume each task closes its section independently
    return acc + t.durationHours;
  }, 0);

  const megaBlockStart = Math.min(...DEMO_TASKS.map((t) => t.optimizedStart));
  const megaBlockEnd = Math.max(...DEMO_TASKS.map((t) => t.optimizedStart + t.durationHours));
  const megaBlockHours = megaBlockEnd - megaBlockStart;
  const savedHours = parseFloat((baselineTotalHours - megaBlockHours).toFixed(1));

  const reset = () => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    setAnimState('idle');
    setSolverStepIdx(-1);
    setCompletedSteps([]);
    setTaskPositions(Object.fromEntries(DEMO_TASKS.map((t) => [t.id, t.baselineStart])));
    setDowntimeSaved(0);
    setShowMegaBlock(false);
    setPulseMetric(false);
  };

  const runSolver = async () => {
    reset();
    // tiny delay so reset visually settles first
    await new Promise((r) => setTimeout(r, 80));
    setAnimState('solving');

    let delay = 0;
    SOLVER_STEPS.forEach((step, i) => {
      stepTimerRef.current = setTimeout(() => {
        setSolverStepIdx(i);
        setCompletedSteps((prev) => (i > 0 ? [...prev, i - 1] : prev));
      }, delay);
      delay += step.duration;
    });

    // After all steps: animate tasks sliding together
    stepTimerRef.current = setTimeout(() => {
      setCompletedSteps(SOLVER_STEPS.map((_, i) => i));
      setSolverStepIdx(-1);
    }, delay);

    delay += 200;

    stepTimerRef.current = setTimeout(() => {
      // Animate task positions to optimised
      setTaskPositions(Object.fromEntries(DEMO_TASKS.map((t) => [t.id, t.optimizedStart])));
    }, delay);

    delay += 900; // wait for CSS transition

    stepTimerRef.current = setTimeout(() => {
      setShowMegaBlock(true);
    }, delay);

    delay += 500;

    stepTimerRef.current = setTimeout(() => {
      // Count up downtime saved
      let val = 0;
      const increment = savedHours / 30;
      const ticker = setInterval(() => {
        val = parseFloat((val + increment).toFixed(1));
        if (val >= savedHours) {
          val = savedHours;
          clearInterval(ticker);
          setPulseMetric(true);
        }
        setDowntimeSaved(val);
      }, 40);
    }, delay);

    delay += 1500;

    stepTimerRef.current = setTimeout(() => {
      setAnimState('done');
    }, delay);
  };

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, []);

  // Hour tick marks
  const hourTicks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  return (
    <div className="space-y-5">
      {/* ── Top metric bar ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Downtime Saved — hero metric */}
        <div
          className={`col-span-1 sm:col-span-1 relative p-5 rounded-xl border overflow-hidden transition-all duration-500 ${
            animState === 'done'
              ? 'bg-emerald-950/40 border-emerald-600/60 shadow-[0_0_30px_rgba(16,185,129,0.18)]'
              : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          {/* animated glow ring when done */}
          {animState === 'done' && (
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.12) 0%, transparent 70%)',
              }}
            />
          )}
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
            <TrendingDown className="w-3 h-3 text-emerald-400" />
            Track Downtime Saved
          </div>
          <div
            className={`text-4xl font-black font-mono transition-all duration-300 ${
              animState === 'done' ? 'text-emerald-400' : 'text-slate-600'
            } ${pulseMetric ? 'drop-shadow-[0_0_12px_rgba(16,185,129,0.7)]' : ''}`}
          >
            {downtimeSaved.toFixed(1)}
            <span className="text-lg font-bold text-emerald-500/70 ml-1">hrs</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            vs. baseline sequential scheduling ({baselineTotalHours.toFixed(1)} hrs total)
          </p>
        </div>

        {/* Mega-Block window */}
        <div
          className={`p-5 rounded-xl border transition-all duration-500 ${
            showMegaBlock
              ? 'bg-blue-950/30 border-blue-600/50 shadow-[0_0_24px_rgba(59,130,246,0.14)]'
              : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-blue-400" />
            Mega-Block Window
          </div>
          <div
            className={`text-2xl font-bold font-mono transition-all duration-500 ${
              showMegaBlock ? 'text-cyan-300' : 'text-slate-600'
            }`}
          >
            {formatHour(megaBlockStart)} – {formatHour(megaBlockEnd)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {megaBlockHours.toFixed(1)} hr consolidated corridor closure · 5 tasks packed
          </p>
        </div>

        {/* CP-SAT score */}
        <div
          className={`p-5 rounded-xl border transition-all duration-500 ${
            animState === 'done'
              ? 'bg-purple-950/30 border-purple-600/50 shadow-[0_0_24px_rgba(168,85,247,0.14)]'
              : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-purple-400" />
            CP-SAT Optimization Score
          </div>
          <div
            className={`text-4xl font-black font-mono transition-all duration-500 ${
              animState === 'done' ? 'text-purple-300' : 'text-slate-600'
            }`}
          >
            {animState === 'done' ? '94.2' : '--'}
            <span className="text-sm font-semibold text-purple-400/60 ml-1">/ 100</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Evaluated on priority completion, minimal disruption & availability gain
          </p>
        </div>
      </div>

      {/* ── Main card: Gantt + Solver ──────────────────────────────────────── */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-lg shadow-black/40">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-800/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400">
                <Cpu className="w-4 h-4" />
              </span>
              <h3 className="text-base font-semibold text-slate-100 tracking-tight">
                CP-SAT Gantt Visualiser
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-cyan-950/80 text-cyan-300 border border-cyan-700/60">
                OR-Tools
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 ml-9">
              Watch how the constraint solver packs 5 tasks from scattered baseline windows into a
              single Mega-Block closure.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {animState !== 'idle' && (
              <button
                onClick={reset}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            <button
              onClick={runSolver}
              disabled={animState === 'solving'}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
                animState === 'solving'
                  ? 'bg-slate-800 border border-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-500 text-white shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02]'
              }`}
            >
              {animState === 'solving' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Solving CP-SAT…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Execute CP-SAT Optimisation
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* ── LEFT: Solver log (1 col) ─────────────────────────────── */}
          <div className="xl:col-span-1 space-y-2">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-cyan-400" />
              Solver Log
            </div>

            {animState === 'idle' ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 mb-3">
                  <Cpu className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
                  Press "Execute CP-SAT Optimisation" to watch the solver run in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {SOLVER_STEPS.map((step, i) => {
                  const isDone = completedSteps.includes(i);
                  const isActive = solverStepIdx === i;
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border text-xs transition-all duration-300 ${
                        isDone
                          ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                          : isActive
                          ? 'bg-blue-950/40 border-blue-700/60 text-blue-200'
                          : 'bg-slate-900/40 border-slate-800/40 text-slate-600'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0">
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : isActive ? (
                            <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-700" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold">{step.label}</div>
                          {(isDone || isActive) && (
                            <div
                              className={`text-[10px] mt-0.5 ${
                                isDone ? 'text-emerald-400/70' : 'text-blue-300/70'
                              }`}
                            >
                              {step.detail}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {animState === 'done' && (
                  <div className="mt-3 p-3 rounded-lg border bg-purple-950/20 border-purple-700/40 text-xs text-purple-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="font-bold">Solution found · Optimal</div>
                      <div className="text-[10px] text-purple-400/70 mt-0.5">
                        Wall time: 3.7s · Branches explored: 1,204
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Gantt chart (2 cols) ──────────────────────────── */}
          <div className="xl:col-span-2">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-3 flex items-center gap-2">
              <Clock className="w-3 h-3 text-blue-400" />
              24-Hour Corridor Timeline
              {animState !== 'idle' && (
                <span className="ml-auto flex items-center gap-1 text-slate-400 font-normal normal-case">
                  <span
                    className="w-3 h-2.5 rounded-sm inline-block"
                    style={{ background: 'rgba(59,130,246,0.4)' }}
                  />
                  Baseline
                  <ArrowRight className="w-3 h-3 mx-0.5 text-slate-600" />
                  <span
                    className="w-3 h-2.5 rounded-sm inline-block"
                    style={{ background: 'rgba(16,185,129,0.5)' }}
                  />
                  Optimised
                </span>
              )}
            </div>

            {/* Hour axis */}
            <div className="relative mb-1">
              <div className="flex">
                {hourTicks.map((h) => (
                  <div
                    key={h}
                    className="text-[9px] text-slate-600 font-mono"
                    style={{
                      position: 'absolute',
                      left: `${hourToPercent(h)}%`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              <div className="h-4" />
            </div>

            {/* Gantt rows */}
            <div className="space-y-3">
              {DEMO_TASKS.map((task) => {
                const currentStart = taskPositions[task.id] ?? task.baselineStart;
                const leftPct = hourToPercent(currentStart);
                const widthPct = durationToPercent(task.durationHours);
                const isOptimised = animState !== 'idle' && Math.abs(currentStart - task.optimizedStart) < 0.05;

                return (
                  <div key={task.id} className="flex items-center gap-3">
                    {/* Row label */}
                    <div className="w-36 shrink-0 flex items-center gap-2">
                      <DeptPill dept={task.dept} />
                      <div className="text-[10px] text-slate-300 font-medium truncate">{task.label}</div>
                    </div>

                    {/* Track bar background */}
                    <div className="flex-1 relative h-9 bg-slate-900/80 rounded-lg border border-slate-800/60 overflow-hidden">
                      {/* Hour grid lines */}
                      {hourTicks.map((h) =>
                        h > 0 && h < 24 ? (
                          <div
                            key={h}
                            className="absolute top-0 bottom-0 w-px bg-slate-800/60"
                            style={{ left: `${hourToPercent(h)}%` }}
                          />
                        ) : null
                      )}

                      {/* Mega-block highlight overlay */}
                      {showMegaBlock && (
                        <div
                          className="absolute top-0 bottom-0 transition-all duration-700"
                          style={{
                            left: `${hourToPercent(megaBlockStart)}%`,
                            width: `${durationToPercent(megaBlockHours)}%`,
                            background:
                              'linear-gradient(90deg, rgba(16,185,129,0.07), rgba(59,130,246,0.07))',
                            borderLeft: '2px solid rgba(16,185,129,0.3)',
                            borderRight: '2px solid rgba(16,185,129,0.3)',
                          }}
                        />
                      )}

                      {/* Task block — slides via CSS transition */}
                      <div
                        className={`absolute top-1.5 bottom-1.5 rounded-md bg-gradient-to-r ${task.color} border ${task.borderColor} flex items-center px-2 overflow-hidden`}
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          transition: 'left 0.85s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isOptimised
                            ? `0 0 14px ${task.glowColor}, 0 0 4px ${task.glowColor}`
                            : 'none',
                        }}
                      >
                        <span className="text-[9px] font-bold text-white/90 truncate select-none">
                          {formatHour(currentStart)}
                        </span>
                      </div>
                    </div>

                    {/* Section code */}
                    <div className="w-16 shrink-0 text-[9px] text-slate-500 font-mono text-right">
                      {task.trackCode}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mega-Block annotation */}
            {showMegaBlock && (
              <div
                className="relative mt-4 h-8 overflow-visible"
                style={{ transition: 'opacity 0.5s' }}
              >
                {/* Bracket line */}
                <div
                  className="absolute top-0 h-2 border-t-2 border-l-2 border-r-2 border-emerald-500/60 rounded-t-sm"
                  style={{
                    left: `${(hourToPercent(megaBlockStart) / 100) * (100 - 16 - 4)}% `,
                    width: `${(durationToPercent(megaBlockHours) / 100) * (100 - 16 - 4)}%`,
                    marginLeft: '160px',
                  }}
                />
                <div
                  className="absolute top-3 text-[10px] font-bold text-emerald-400 flex items-center gap-1"
                  style={{
                    left: `calc(160px + ${(hourToPercent(megaBlockStart + megaBlockHours / 2) / 100) * (100 - 164 / 1)}px)`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <Zap className="w-3 h-3" />
                  MEGA-BLOCK · {formatHour(megaBlockStart)}–{formatHour(megaBlockEnd)}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-slate-800/60 flex flex-wrap gap-3">
              {DEMO_TASKS.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm bg-gradient-to-r ${t.color} border ${t.borderColor}`} />
                  <span className="text-[10px] text-slate-400">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Before / After comparison table ───────────────────────────────── */}
      {animState === 'done' && (
        <div className="bg-[#0f172a]/90 border border-slate-800/80 rounded-xl p-5 shadow-lg shadow-black/40">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Baseline vs. CP-SAT Optimised — Comparison
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 pr-4 text-slate-400 font-semibold">Task</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-semibold">Dept</th>
                  <th className="text-center py-2 px-3 text-amber-400 font-semibold">Baseline Window</th>
                  <th className="text-center py-2 px-3 text-emerald-400 font-semibold">
                    CP-SAT Window
                  </th>
                  <th className="text-right py-2 pl-3 text-cyan-400 font-semibold">Shift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {DEMO_TASKS.map((task) => {
                  const shift = task.baselineStart - task.optimizedStart;
                  const shiftLabel =
                    shift > 0
                      ? `−${shift.toFixed(1)} hrs earlier`
                      : shift < 0
                      ? `+${Math.abs(shift).toFixed(1)} hrs later`
                      : 'No change';
                  return (
                    <tr key={task.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-slate-200">{task.label}</td>
                      <td className="py-2.5 px-3">
                        <DeptPill dept={task.dept} />
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-amber-300">
                        {formatHour(task.baselineStart)} –{' '}
                        {formatHour(task.baselineStart + task.durationHours)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-emerald-300">
                        {formatHour(task.optimizedStart)} –{' '}
                        {formatHour(task.optimizedStart + task.durationHours)}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono text-cyan-400 text-[11px]">
                        {shiftLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700">
                  <td colSpan={2} className="py-3 text-slate-400 font-semibold">
                    Total track-closure
                  </td>
                  <td className="py-3 text-center font-mono font-bold text-amber-400">
                    {baselineTotalHours.toFixed(1)} hrs
                  </td>
                  <td className="py-3 text-center font-mono font-bold text-emerald-400">
                    {megaBlockHours.toFixed(1)} hrs
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-emerald-400">
                    −{savedHours} hrs saved
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
