export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
}

export interface TrackSection {
  id: number;
  corridor_id: number;
  section_code: string;
  from_station: string;
  to_station: string;
  from_station_code: string;
  to_station_code: string;
  length_km: number;
  available: boolean;
  from_lat?: number;
  from_lng?: number;
  to_lat?: number;
  to_lng?: number;
}

export interface Corridor {
  id: number;
  corridor_code: string;
  name: string;
  description?: string;
  track_sections: TrackSection[];
}

export interface Asset {
  id: number;
  asset_code: string;
  name: string;
  asset_type: string;
  department_id: number;
  department_name?: string;
  location?: string;
  section_id: number;
  section_code?: string;
  criticality: 'Critical' | 'High' | 'Medium' | 'Low';
  condition_score: number;
  availability: number;
  last_maintenance_date?: string;
  next_due_date?: string;
  status: 'Operational' | 'Degraded' | 'Under Maintenance' | 'Failed' | 'Decommissioned';
  position_on_section?: number;
}

export interface MaintenanceHistoryItem {
  id: number;
  asset_id: number;
  asset_code?: string;
  maintenance_task_id?: number;
  completed_date: string;
  downtime_minutes: number;
  condition_before: number;
  condition_after: number;
}

export interface MaintenanceTask {
  id: number;
  task_code: string;
  asset_id: number;
  asset_code?: string;
  asset_name?: string;
  department_id: number;
  department_name?: string;
  department_code?: string;
  section_id: number;
  section_code?: string;
  maintenance_type: 'Preventive' | 'Corrective' | 'Predictive' | 'Emergency' | 'Routine';
  description: string;
  duration_minutes: number;
  priority: number;
  criticality: string;
  urgency: 'Immediate' | 'Urgent' | 'Normal' | 'Planned';
  due_date: string;
  status: 'Pending' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled' | 'Overdue';
  required_resources: Record<string, any>;
  priority_explanation?: string;
}

export interface Train {
  id: number;
  train_number: string;
  train_name: string;
  train_type: string;
  priority: string;
}

export interface TrainSchedule {
  id: number;
  train_id: number;
  train_number?: string;
  train_name?: string;
  section_id: number;
  section_code?: string;
  station_from: string;
  station_to: string;
  arrival_time: string;
  departure_time: string;
  direction: 'Up' | 'Down';
  date: string;
}

export interface BlockWindow {
  id: number;
  section_id: number;
  section_code?: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  status: string;
  duration_minutes?: number;
}

export interface BlockTask {
  id: number;
  block_plan_id: number;
  maintenance_task_id: number;
  task_code?: string;
  task_description?: string;
  start_time: string;
  end_time: string;
}

export interface BlockPlan {
  id: number;
  plan_date: string;
  block_window_id: number;
  section_code?: string;
  window_start?: string;
  window_end?: string;
  status: string;
  optimization_score: number;
  train_disruption_minutes: number;
  asset_availability_impact: number;
  is_integrated: number;
  departments_involved: string[];
  plan_type: string;
  reasoning?: string;
  block_tasks: BlockTask[];
}

export interface ValidationResult {
  feasible: boolean;
  violations: string[];
  warnings: string[];
  score: number;
}

export interface CandidateWindow {
  block_window_id: number;
  section_id: number;
  section_code: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  validation: ValidationResult;
}

export interface TaskCandidate {
  task_id: number;
  task_code: string;
  candidates: CandidateWindow[];
}

export interface OptimizationResult {
  success: boolean;
  plan_type: string;
  total_blocks: number;
  total_block_hours: number;
  integrated_blocks: number;
  total_tasks_scheduled: number;
  total_tasks_unscheduled: number;
  train_disruption_minutes: number;
  asset_availability_improvement: number;
  optimization_score: number;
  plans: BlockPlan[];
  unscheduled_tasks: string[];
  insights: string[];
}

export interface ComparisonResult {
  baseline: OptimizationResult;
  optimized: OptimizationResult;
  improvement: {
    blocks_reduction?: number;
    block_hours_reduction?: number;
    disruption_reduction?: number;
    additional_integrated_blocks?: number;
    availability_improvement?: number;
    score_improvement?: number;
  };
}

export interface DayPlan {
  date: string;
  day_name: string;
  blocks: BlockPlan[];
  total_tasks: number;
  total_block_hours: number;
}

export interface WeeklyPlan {
  week_start: string;
  week_end: string;
  days: DayPlan[];
  summary: {
    total_blocks: number;
    total_tasks: number;
    total_block_hours: number;
    integrated_blocks: number;
  };
}

export interface MonthlyPlan {
  month: number;
  year: number;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  critical_tasks: number;
  total_blocks: number;
  integrated_blocks: number;
  estimated_availability: number;
  estimated_disruption: number;
  weeks: WeeklyPlan[];
}

export interface AnalyticsSummary {
  asset_availability: number;
  pending_maintenance: number;
  critical_maintenance: number;
  optimized_blocks: number;
  integrated_blocks: number;
  train_disruption_hours: number;
  planning_efficiency: number;
  total_assets: number;
  total_trains: number;
  total_sections: number;
  assets_by_department: Record<string, number>;
  assets_by_status: Record<string, number>;
  tasks_by_priority: Record<string, number>;
  tasks_by_department: Record<string, number>;
  condition_distribution: Record<string, number>;
}

export interface StationNode {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export interface SectionEdge {
  id: number;
  section_code: string;
  from_station: string;
  to_station: string;
  length_km: number;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  assets: Asset[];
  active_blocks: number;
}

export interface NetworkData {
  corridor: string;
  stations: StationNode[];
  sections: SectionEdge[];
}

export interface AIInsight {
  type: 'priority' | 'grouping' | 'conflict' | 'recommendation';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  related_task?: string;
  related_asset?: string;
  related_section?: string;
}

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  train_demand_multiplier: number;
}

export interface SimulationComparison {
  blocks_saved: number;
  blocks_saved_pct: number;
  delay_saved_minutes: number;
  delay_reduction_pct: number;
  integrated_blocks_count: number;
  availability_improvement: number;
  verdict: string;
}

export interface SimulationResult {
  scenario_name: string;
  scenario_description?: string;
  baseline?: OptimizationResult;
  optimized?: OptimizationResult;
  before: OptimizationResult;
  after: OptimizationResult;
  comparison?: SimulationComparison;
  changes: Record<string, any>;
}

export interface AssetDetection {
  asset_id: number;
  asset_code: string;
  name: string;
  asset_type: string;
  department_code: string;
  department_name: string;
  section_code: string;
  condition_score: number;
  availability: number;
  criticality: string;
  status: string;
  next_due_date?: string;
  maintenance_required: boolean;
  maintenance_status: 'CRITICAL' | 'OVERDUE' | 'MAINTENANCE_DUE' | 'MONITOR' | 'HEALTHY';
  detection_score: number;
  reasons: string[];
  factors: Record<string, any>;
  existing_task_id?: number;
  existing_task_code?: string;
  existing_task_status?: string;
}

export interface DetectionSummary {
  total_assets: number;
  critical_assets: number;
  overdue_assets: number;
  maintenance_due: number;
  monitor_assets: number;
  healthy_assets: number;
  requiring_maintenance: number;
}

export interface ScanResult {
  success: boolean;
  scan_timestamp: string;
  summary: DetectionSummary;
  created_tasks_count: number;
  updated_tasks_count: number;
  active_detections: AssetDetection[];
}

