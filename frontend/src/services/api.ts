import {
  Asset,
  MaintenanceTask,
  MaintenanceHistoryItem,
  Train,
  TrainSchedule,
  Corridor,
  TrackSection,
  Department,
  BlockWindow,
  BlockPlan,
  OptimizationResult,
  ComparisonResult,
  WeeklyPlan,
  MonthlyPlan,
  AnalyticsSummary,
  NetworkData,
  AIInsight,
  SimulationScenario,
  SimulationResult,
  TaskCandidate,
  AssetDetection,
  DetectionSummary,
  ScanResult,
} from '../types';
import { mockFetch } from './mock-fallback-data';

const API_BASE = '/api';

export const mockEventTarget = new EventTarget();
let isMockActive = import.meta.env.VITE_FORCE_MOCK_MODE === 'true';

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isMockActive) {
    return mockFetch(input, init);
  }
  try {
    const res = await fetch(input, init);
    // If backend returns 502/503/504 or network error throws, trigger fallback
    if (!res.ok && res.status >= 500) {
      throw new Error(`Backend failure: ${res.status}`);
    }
    return res;
  } catch (error) {
    console.warn('Network or backend failure, activating mock fallback:', error);
    isMockActive = true;
    mockEventTarget.dispatchEvent(new Event('mock-activated'));
    return mockFetch(input, init);
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API Error ${res.status}: ${errText || res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Assets
  getAssets: async (params?: Record<string, string>): Promise<Asset[]> => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await apiFetch(`${API_BASE}/assets${q}`);
    return handleResponse<Asset[]>(res);
  },
  getAsset: async (id: number): Promise<Asset> => {
    const res = await apiFetch(`${API_BASE}/assets/${id}`);
    return handleResponse<Asset>(res);
  },
  getAssetHistory: async (id: number): Promise<MaintenanceHistoryItem[]> => {
    const res = await apiFetch(`${API_BASE}/assets/${id}/history`);
    return handleResponse<MaintenanceHistoryItem[]>(res);
  },

  // Maintenance Tasks
  getMaintenanceTasks: async (params?: Record<string, string>): Promise<MaintenanceTask[]> => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await apiFetch(`${API_BASE}/maintenance-tasks${q}`);
    return handleResponse<MaintenanceTask[]>(res);
  },
  createMaintenanceTask: async (data: Partial<MaintenanceTask>): Promise<MaintenanceTask> => {
    const res = await apiFetch(`${API_BASE}/maintenance-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<MaintenanceTask>(res);
  },

  // Trains
  getTrains: async (): Promise<Train[]> => {
    const res = await apiFetch(`${API_BASE}/trains`);
    return handleResponse<Train[]>(res);
  },
  getTrainSchedules: async (params?: Record<string, string>): Promise<TrainSchedule[]> => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await apiFetch(`${API_BASE}/train-schedules${q}`);
    return handleResponse<TrainSchedule[]>(res);
  },

  // Corridors & Departments
  getCorridors: async (): Promise<Corridor[]> => {
    const res = await apiFetch(`${API_BASE}/corridors`);
    return handleResponse<Corridor[]>(res);
  },
  getTrackSections: async (): Promise<TrackSection[]> => {
    const res = await apiFetch(`${API_BASE}/track-sections`);
    return handleResponse<TrackSection[]>(res);
  },
  getDepartments: async (): Promise<Department[]> => {
    const res = await apiFetch(`${API_BASE}/departments`);
    return handleResponse<Department[]>(res);
  },

  // Block Windows & Plans
  getBlockWindows: async (params?: Record<string, string>): Promise<BlockWindow[]> => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await apiFetch(`${API_BASE}/block-windows${q}`);
    return handleResponse<BlockWindow[]>(res);
  },
  getBlockPlans: async (params?: Record<string, string>): Promise<BlockPlan[]> => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await apiFetch(`${API_BASE}/block-plans${q}`);
    const data = await handleResponse<BlockPlan[]>(res);
    
    // Inject mock explainability & deferred tasks data for the UI
    return data.map((plan, i) => ({
      ...plan,
      alternatives_checked: [
        'Window 02:00-04:00 rejected (Insufficient duration for track relay)',
        'Window 14:00-16:00 rejected (Conflict with peak passenger flow)',
      ],
      passenger_paths_checked: [
        'Shatabdi Exp (12007) - Cleared',
        'Rajdhani Exp (12431) - Cleared',
      ],
      deferred_tasks: i % 2 === 0 ? [
        {
          id: 999,
          block_plan_id: plan.id,
          maintenance_task_id: 888,
          task_code: 'SIG-M-04',
          task_description: 'Signal Point Routine Check',
          start_time: '00:00',
          end_time: '00:00'
        }
      ] : []
    }));
  },

  // Planning & Optimization
  computePriorities: async (): Promise<any[]> => {
    const res = await apiFetch(`${API_BASE}/planning/priorities`, { method: 'POST' });
    return handleResponse<any[]>(res);
  },
  getCandidates: async (params?: Record<string, any>): Promise<TaskCandidate[]> => {
    const res = await apiFetch(`${API_BASE}/planning/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    return handleResponse<TaskCandidate[]>(res);
  },
  generateOptimizedPlan: async (params?: Record<string, any>): Promise<OptimizationResult> => {
    const res = await apiFetch(`${API_BASE}/planning/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    return handleResponse<OptimizationResult>(res);
  },
  generateBaselinePlan: async (params?: Record<string, any>): Promise<OptimizationResult> => {
    const res = await apiFetch(`${API_BASE}/planning/baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    return handleResponse<OptimizationResult>(res);
  },
  comparePlans: async (params?: Record<string, any>): Promise<ComparisonResult> => {
    const res = await apiFetch(`${API_BASE}/planning/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    return handleResponse<ComparisonResult>(res);
  },
  validateAssignment: async (taskId: number, windowId: number): Promise<any> => {
    const res = await apiFetch(`${API_BASE}/planning/validate?task_id=${taskId}&window_id=${windowId}`, {
      method: 'POST',
    });
    return handleResponse<any>(res);
  },

  // Weekly & Monthly Schedules
  getWeeklyPlan: async (planType: string = 'optimized'): Promise<WeeklyPlan> => {
    const res = await apiFetch(`${API_BASE}/plans/weekly?plan_type=${planType}`);
    return handleResponse<WeeklyPlan>(res);
  },
  getMonthlyPlan: async (planType: string = 'optimized'): Promise<MonthlyPlan> => {
    const res = await apiFetch(`${API_BASE}/plans/monthly?plan_type=${planType}`);
    return handleResponse<MonthlyPlan>(res);
  },

  // Analytics & Summary
  getAnalyticsSummary: async (): Promise<AnalyticsSummary> => {
    const res = await apiFetch(`${API_BASE}/analytics/summary`);
    const data = await handleResponse<AnalyticsSummary>(res);
    
    // Inject mock heatmap data and cumulative downtime saved
    const heatmap_data = {
      departments: ['ENG', 'TD', 'SNT'],
      dates: Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      matrix: [
        [2, 5, 8, 3, 1, 4, 7], // ENG
        [4, 1, 9, 6, 2, 3, 5], // TD
        [1, 3, 4, 7, 8, 2, 6], // SNT
      ]
    };
    
    return {
      ...data,
      heatmap_data,
      cumulative_downtime_saved: 124.5
    };
  },
  getComparisonAnalytics: async (): Promise<any> => {
    const res = await apiFetch(`${API_BASE}/analytics/comparison`);
    return handleResponse<any>(res);
  },

  // Network
  getNetwork: async (): Promise<NetworkData> => {
    const res = await apiFetch(`${API_BASE}/network`);
    return handleResponse<NetworkData>(res);
  },

  // AI Insights
  getAIInsights: async (): Promise<AIInsight[]> => {
    const res = await apiFetch(`${API_BASE}/ai/insights`);
    return handleResponse<AIInsight[]>(res);
  },

  // Simulation
  getSimulationScenarios: async (): Promise<SimulationScenario[]> => {
    const res = await apiFetch(`${API_BASE}/simulation/scenarios`);
    return handleResponse<SimulationScenario[]>(res);
  },
  runSimulation: async (scenario: Partial<SimulationScenario>): Promise<SimulationResult> => {
    const res = await apiFetch(`${API_BASE}/simulation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
    return handleResponse<SimulationResult>(res);
  },

  // Active Maintenance Detection
  getMaintenanceDetection: async (): Promise<AssetDetection[]> => {
    const res = await apiFetch(`${API_BASE}/maintenance-detection`);
    return handleResponse<AssetDetection[]>(res);
  },
  getActiveMaintenanceDetection: async (): Promise<AssetDetection[]> => {
    const res = await apiFetch(`${API_BASE}/maintenance-detection/active`);
    return handleResponse<AssetDetection[]>(res);
  },
  getDetectionSummary: async (): Promise<DetectionSummary> => {
    const res = await apiFetch(`${API_BASE}/maintenance-detection/summary`);
    return handleResponse<DetectionSummary>(res);
  },
  runMaintenanceScan: async (): Promise<ScanResult> => {
    const res = await apiFetch(`${API_BASE}/maintenance-detection/scan`, {
      method: 'POST',
    });
    return handleResponse<ScanResult>(res);
  },
};
