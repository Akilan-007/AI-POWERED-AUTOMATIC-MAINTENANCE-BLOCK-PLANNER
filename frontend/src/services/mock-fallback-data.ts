import {
  Asset,
  MaintenanceTask,
  BlockPlan,
  AnalyticsSummary,
  DetectionSummary,
  AssetDetection,
} from '../types';

// Utility for simulated latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomDelay = () => delay(Math.floor(Math.random() * 600) + 300); // 300-900ms

const MOCK_DETECTION_SUMMARY: DetectionSummary = {
  total_assets: 28,
  critical_assets: 3,
  overdue_assets: 5,
  maintenance_due: 7,
  monitor_assets: 5,
  healthy_assets: 8,
  requiring_maintenance: 15,
};

const MOCK_TASKS: MaintenanceTask[] = [
  {
    id: 101,
    task_code: 'TRK-M-001',
    asset_id: 1,
    asset_code: 'TRK-KRR-01',
    asset_name: 'Karur Mainline Track A',
    department_id: 1,
    department_code: 'ENG',
    department_name: 'Engineering',
    section_id: 1,
    section_code: 'KRR-1',
    maintenance_type: 'Predictive',
    description: 'Track relaying and ballast tamping',
    duration_minutes: 180,
    priority: 95,
    criticality: 'Critical',
    urgency: 'Immediate',
    due_date: new Date().toISOString().split('T')[0],
    status: 'Pending',
    required_resources: {},
    priority_explanation: 'High priority due to critical condition score and heavy mainline traffic.',
  },
  {
    id: 102,
    task_code: 'SIG-M-002',
    asset_id: 2,
    asset_code: 'SIG-KRR-05',
    asset_name: 'Karur Point Machine 5',
    department_id: 2,
    department_code: 'SNT',
    department_name: 'Signaling & Telecom',
    section_id: 1,
    section_code: 'KRR-1',
    maintenance_type: 'Preventive',
    description: 'Point machine recalibration',
    duration_minutes: 60,
    priority: 85,
    criticality: 'High',
    urgency: 'Urgent',
    due_date: new Date().toISOString().split('T')[0],
    status: 'Overdue',
    required_resources: {},
    priority_explanation: 'Overdue maintenance impacting route-setting reliability.',
  },
  {
    id: 103,
    task_code: 'OHE-M-003',
    asset_id: 3,
    asset_code: 'OHE-KRR-12',
    asset_name: 'Karur OHE Section 12',
    department_id: 3,
    department_code: 'TD',
    department_name: 'Traction Dist.',
    section_id: 1,
    section_code: 'KRR-1',
    maintenance_type: 'Corrective',
    description: 'Contact wire tension adjustment',
    duration_minutes: 120,
    priority: 88,
    criticality: 'Critical',
    urgency: 'Immediate',
    due_date: new Date().toISOString().split('T')[0],
    status: 'Pending',
    required_resources: {},
    priority_explanation: 'Tension drop detected, risks pantograph entanglement.',
  },
  {
    id: 104,
    task_code: 'TRK-M-004',
    asset_id: 4,
    asset_code: 'TRK-KRR-02',
    asset_name: 'Karur Loop Line B',
    department_id: 1,
    department_code: 'ENG',
    department_name: 'Engineering',
    section_id: 2,
    section_code: 'KRR-2',
    maintenance_type: 'Routine',
    description: 'Routine visual inspection',
    duration_minutes: 45,
    priority: 45,
    criticality: 'Low',
    urgency: 'Normal',
    due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    status: 'Scheduled',
    required_resources: {},
    priority_explanation: 'Routine schedule, no anomalies detected.',
  },
  {
    id: 105,
    task_code: 'SIG-M-005',
    asset_id: 5,
    asset_code: 'SIG-KRR-09',
    asset_name: 'Karur Signal Panel',
    department_id: 2,
    department_code: 'SNT',
    department_name: 'Signaling & Telecom',
    section_id: 1,
    section_code: 'KRR-1',
    maintenance_type: 'Preventive',
    description: 'Interlocking relay check',
    duration_minutes: 90,
    priority: 75,
    criticality: 'Medium',
    urgency: 'Planned',
    due_date: new Date(Date.now() + 86400000 * 1).toISOString().split('T')[0],
    status: 'Pending',
    required_resources: {},
    priority_explanation: 'Upcoming due date, requires coordinated block.',
  }
];

const MOCK_ACTIVE_DETECTIONS: AssetDetection[] = MOCK_TASKS.slice(0, 3).map(task => ({
  asset_id: task.asset_id,
  asset_code: task.asset_code!,
  name: task.asset_name!,
  asset_type: 'Track/Signal',
  department_code: task.department_code!,
  department_name: task.department_name!,
  section_code: task.section_code!,
  condition_score: 100 - task.priority,
  availability: 95,
  criticality: task.criticality,
  status: 'Degraded',
  maintenance_required: true,
  maintenance_status: task.criticality === 'Critical' ? 'CRITICAL' : 'OVERDUE',
  detection_score: task.priority,
  reasons: [task.priority_explanation || 'Detected anomaly'],
  factors: {},
  existing_task_id: task.id,
  existing_task_code: task.task_code,
  existing_task_status: task.status
}));

const MOCK_BLOCK_PLANS: BlockPlan[] = [
  {
    id: 1,
    plan_date: new Date().toISOString().split('T')[0],
    block_window_id: 1,
    section_code: 'KRR-1 (Karur Mainline)',
    window_start: '02:00',
    window_end: '05:00',
    status: 'Draft',
    optimization_score: 92,
    train_disruption_minutes: 15,
    asset_availability_impact: 4.5,
    is_integrated: 1,
    departments_involved: ['ENG', 'TD', 'SNT'],
    plan_type: 'optimized',
    block_tasks: MOCK_TASKS.slice(0, 3).map(t => ({
      id: t.id + 1000,
      block_plan_id: 1,
      maintenance_task_id: t.id,
      task_code: t.task_code,
      task_description: t.description,
      start_time: '02:00',
      end_time: '05:00',
    }))
  }
];

const MOCK_ANALYTICS: AnalyticsSummary = {
  asset_availability: 92.4,
  pending_maintenance: 12,
  critical_maintenance: 3,
  optimized_blocks: 8,
  integrated_blocks: 5,
  train_disruption_hours: 2.5,
  planning_efficiency: 88,
  total_assets: 28,
  total_trains: 45,
  total_sections: 12,
  assets_by_department: { ENG: 12, SNT: 9, TD: 7 },
  assets_by_status: { Operational: 15, Degraded: 8, Critical: 5 },
  tasks_by_priority: { High: 5, Medium: 15, Low: 10 },
  tasks_by_department: { ENG: 10, SNT: 8, TD: 7 },
  condition_distribution: { Good: 12, Fair: 10, Poor: 6 }
};

export const createMockResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  await randomDelay();
  const urlStr = typeof input === 'string' ? input : input.toString();

  // Route matching
  if (urlStr.includes('/analytics/summary')) return createMockResponse(MOCK_ANALYTICS);
  if (urlStr.includes('/maintenance-tasks')) return createMockResponse(MOCK_TASKS);
  if (urlStr.includes('/maintenance-detection/summary')) return createMockResponse(MOCK_DETECTION_SUMMARY);
  if (urlStr.includes('/maintenance-detection/active')) return createMockResponse(MOCK_ACTIVE_DETECTIONS);
  if (urlStr.includes('/maintenance-detection/scan')) return createMockResponse({
    success: true,
    scan_timestamp: new Date().toISOString(),
    summary: MOCK_DETECTION_SUMMARY,
    created_tasks_count: 2,
    updated_tasks_count: 3,
    active_detections: MOCK_ACTIVE_DETECTIONS
  });
  if (urlStr.includes('/block-plans')) return createMockResponse(MOCK_BLOCK_PLANS);
  if (urlStr.includes('/ai/insights')) return createMockResponse([
    {
      type: 'grouping',
      severity: 'info',
      message: 'Karur Mainline (KRR-1) tasks across ENG, SNT, and TD grouped successfully for 02:00-05:00 window.'
    },
    {
      type: 'priority',
      severity: 'warning',
      message: 'OHE tension adjustment escalated due to critical condition score.'
    }
  ]);
  
  if (urlStr.includes('/network')) return createMockResponse({
    corridor: 'Southern Railway Mainline',
    stations: [
      { code: 'MAS', name: 'Chennai Central', lat: 13.0827, lng: 80.2707 },
      { code: 'KPD', name: 'Katpadi Jn', lat: 12.9692, lng: 79.1381 },
      { code: 'SA', name: 'Salem Jn', lat: 11.6749, lng: 78.1348 },
      { code: 'ED', name: 'Erode Jn', lat: 11.3286, lng: 77.7315 },
      { code: 'KRR', name: 'Karur Jn', lat: 10.9601, lng: 78.0772 },
    ],
    sections: [
      {
        id: 1, section_code: 'SEC-1', from_station: 'Chennai Central', to_station: 'Katpadi Jn', length_km: 130,
        from_lat: 13.0827, from_lng: 80.2707, to_lat: 12.9692, to_lng: 79.1381, assets: [], active_blocks: 1
      },
      {
        id: 2, section_code: 'SEC-2', from_station: 'Katpadi Jn', to_station: 'Salem Jn', length_km: 210,
        from_lat: 12.9692, from_lng: 79.1381, to_lat: 11.6749, to_lng: 78.1348, assets: [], active_blocks: 0
      },
      {
        id: 3, section_code: 'SEC-3', from_station: 'Salem Jn', to_station: 'Erode Jn', length_km: 60,
        from_lat: 11.6749, from_lng: 78.1348, to_lat: 11.3286, to_lng: 77.7315, assets: [], active_blocks: 1
      },
      {
        id: 4, section_code: 'SEC-4', from_station: 'Erode Jn', to_station: 'Karur Jn', length_km: 65,
        from_lat: 11.3286, from_lng: 77.7315, to_lat: 10.9601, to_lng: 78.0772, assets: [], active_blocks: 1
      }
    ]
  });

  // Provide empty/default arrays for endpoints we haven't explicitly mocked,
  // to avoid crashes if other pages are loaded.
  if (urlStr.includes('weekly') || urlStr.includes('monthly')) return createMockResponse({ days: [], summary: {}, weeks: [] });
  
  return createMockResponse([]);
};
