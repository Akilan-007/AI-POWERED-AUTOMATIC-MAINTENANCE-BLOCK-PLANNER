"""Pydantic schemas for API request/response validation."""

from datetime import date, time, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ─────────────────────── Department ───────────────────────

class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


# ─────────────────────── Corridor / Section ───────────────────────

class TrackSectionOut(BaseModel):
    id: int
    corridor_id: int
    section_code: str
    from_station: str
    to_station: str
    from_station_code: str
    to_station_code: str
    length_km: float
    available: bool
    from_lat: Optional[float] = None
    from_lng: Optional[float] = None
    to_lat: Optional[float] = None
    to_lng: Optional[float] = None

    class Config:
        from_attributes = True


class CorridorOut(BaseModel):
    id: int
    corridor_code: str
    name: str
    description: Optional[str] = None
    track_sections: list[TrackSectionOut] = []

    class Config:
        from_attributes = True


# ─────────────────────── Asset ───────────────────────

class AssetOut(BaseModel):
    id: int
    asset_code: str
    name: str
    asset_type: str
    department_id: int
    department_name: Optional[str] = None
    location: Optional[str] = None
    section_id: int
    section_code: Optional[str] = None
    criticality: str
    condition_score: float
    availability: float
    last_maintenance_date: Optional[date] = None
    next_due_date: Optional[date] = None
    status: str
    position_on_section: Optional[float] = None

    class Config:
        from_attributes = True


# ─────────────────────── Train ───────────────────────

class TrainOut(BaseModel):
    id: int
    train_number: str
    train_name: str
    train_type: str
    priority: str

    class Config:
        from_attributes = True


class TrainScheduleOut(BaseModel):
    id: int
    train_id: int
    train_number: Optional[str] = None
    train_name: Optional[str] = None
    section_id: int
    section_code: Optional[str] = None
    station_from: str
    station_to: str
    arrival_time: time
    departure_time: time
    direction: str
    date: date

    class Config:
        from_attributes = True


# ─────────────────────── Maintenance Task ───────────────────────

class MaintenanceTaskCreate(BaseModel):
    task_code: str
    asset_id: int
    department_id: int
    section_id: int
    maintenance_type: str
    description: str
    duration_minutes: int = Field(ge=15)
    criticality: str = "Medium"
    urgency: str = "Normal"
    due_date: date
    required_resources: dict = {}


class MaintenanceTaskOut(BaseModel):
    id: int
    task_code: str
    asset_id: int
    asset_code: Optional[str] = None
    asset_name: Optional[str] = None
    department_id: int
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    section_id: int
    section_code: Optional[str] = None
    maintenance_type: str
    description: str
    duration_minutes: int
    priority: int
    criticality: str
    urgency: str
    due_date: date
    status: str
    required_resources: dict = {}
    priority_explanation: Optional[str] = None

    class Config:
        from_attributes = True


# ─────────────────────── Block Window ───────────────────────

class BlockWindowOut(BaseModel):
    id: int
    section_id: int
    section_code: Optional[str] = None
    date: date
    start_time: time
    end_time: time
    capacity: int
    status: str
    duration_minutes: Optional[int] = None

    class Config:
        from_attributes = True


# ─────────────────────── Block Plan ───────────────────────

class BlockTaskOut(BaseModel):
    id: int
    block_plan_id: int
    maintenance_task_id: int
    task_code: Optional[str] = None
    task_description: Optional[str] = None
    start_time: time
    end_time: time

    class Config:
        from_attributes = True


class BlockPlanOut(BaseModel):
    id: int
    plan_date: date
    block_window_id: int
    section_code: Optional[str] = None
    window_start: Optional[time] = None
    window_end: Optional[time] = None
    status: str
    optimization_score: float
    train_disruption_minutes: float
    asset_availability_impact: float
    is_integrated: int
    departments_involved: list = []
    plan_type: str
    reasoning: Optional[str] = None
    block_tasks: list[BlockTaskOut] = []

    class Config:
        from_attributes = True


# ─────────────────────── Maintenance History ───────────────────────

class MaintenanceHistoryOut(BaseModel):
    id: int
    asset_id: int
    asset_code: Optional[str] = None
    maintenance_task_id: Optional[int] = None
    completed_date: date
    downtime_minutes: int
    condition_before: float
    condition_after: float

    class Config:
        from_attributes = True


# ─────────────────────── Planning ───────────────────────

class PlanningRequest(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    task_ids: Optional[list[int]] = None
    plan_type: str = "optimized"  # "optimized" or "baseline"


class ValidationResult(BaseModel):
    feasible: bool
    violations: list[str] = []
    warnings: list[str] = []
    score: float = 0.0


class CandidateWindow(BaseModel):
    block_window_id: int
    section_id: int
    section_code: str
    date: date
    start_time: time
    end_time: time
    duration_minutes: int
    validation: ValidationResult


class TaskCandidates(BaseModel):
    task_id: int
    task_code: str
    candidates: list[CandidateWindow]


class OptimizationResult(BaseModel):
    success: bool
    plan_type: str
    total_blocks: int
    total_block_hours: float
    integrated_blocks: int
    total_tasks_scheduled: int
    total_tasks_unscheduled: int
    train_disruption_minutes: float
    asset_availability_improvement: float
    optimization_score: float
    plans: list[BlockPlanOut] = []
    unscheduled_tasks: list[str] = []
    insights: list[str] = []


class ComparisonResult(BaseModel):
    baseline: OptimizationResult
    optimized: OptimizationResult
    improvement: dict = {}


# ─────────────────────── Weekly / Monthly Plan ───────────────────────

class DayPlan(BaseModel):
    date: date
    day_name: str
    blocks: list[BlockPlanOut] = []
    total_tasks: int = 0
    total_block_hours: float = 0.0


class WeeklyPlanOut(BaseModel):
    week_start: date
    week_end: date
    days: list[DayPlan] = []
    summary: dict = {}


class MonthlyPlanOut(BaseModel):
    month: int
    year: int
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    critical_tasks: int
    total_blocks: int
    integrated_blocks: int
    estimated_availability: float
    estimated_disruption: float
    weeks: list[WeeklyPlanOut] = []


# ─────────────────────── Analytics ───────────────────────

class AnalyticsSummary(BaseModel):
    asset_availability: float
    pending_maintenance: int
    critical_maintenance: int
    optimized_blocks: int
    integrated_blocks: int
    train_disruption_hours: float
    planning_efficiency: float
    total_assets: int
    total_trains: int
    total_sections: int
    assets_by_department: dict = {}
    assets_by_status: dict = {}
    tasks_by_priority: dict = {}
    tasks_by_department: dict = {}
    condition_distribution: dict = {}


# ─────────────────────── Network ───────────────────────

class StationNode(BaseModel):
    code: str
    name: str
    lat: float
    lng: float


class SectionEdge(BaseModel):
    id: int
    section_code: str
    from_station: str
    to_station: str
    length_km: float
    from_lat: float
    from_lng: float
    to_lat: float
    to_lng: float
    assets: list[AssetOut] = []
    active_blocks: int = 0


class NetworkOut(BaseModel):
    corridor: str
    stations: list[StationNode]
    sections: list[SectionEdge]


# ─────────────────────── AI Insights ───────────────────────

class InsightOut(BaseModel):
    type: str  # "priority", "grouping", "conflict", "recommendation"
    severity: str  # "critical", "warning", "info"
    message: str
    related_task: Optional[str] = None
    related_asset: Optional[str] = None
    related_section: Optional[str] = None


# ─────────────────────── Simulation ───────────────────────

class SimulationScenario(BaseModel):
    name: str
    description: str
    train_demand_multiplier: float = 1.0
    urgent_task_ids: list[int] = []
    asset_condition_overrides: dict = {}
    additional_tasks: list[MaintenanceTaskCreate] = []


class SimulationComparison(BaseModel):
    blocks_saved: int
    blocks_saved_pct: float
    delay_saved_minutes: float
    delay_reduction_pct: float
    integrated_blocks_count: int
    availability_improvement: float
    verdict: str


class SimulationResult(BaseModel):
    scenario_name: str
    scenario_description: str = ""
    baseline: OptimizationResult
    optimized: OptimizationResult
    before: OptimizationResult
    after: OptimizationResult
    comparison: SimulationComparison
    changes: dict = {}


# ─────────────────────── Priority ───────────────────────

class PriorityResult(BaseModel):
    task_id: int
    task_code: str
    priority_score: int
    classification: str
    explanation: str
    factors: dict = {}


# ─────────────────────── Active Maintenance Detection ───────────────────────

class AssetDetectionOut(BaseModel):
    asset_id: int
    asset_code: str
    name: str
    asset_type: str
    department_code: str
    department_name: str
    section_code: str
    condition_score: float
    availability: float
    criticality: str
    status: str
    next_due_date: Optional[str] = None
    maintenance_required: bool
    maintenance_status: str
    detection_score: int
    reasons: list[str] = []
    factors: dict = {}
    existing_task_id: Optional[int] = None
    existing_task_code: Optional[str] = None
    existing_task_status: Optional[str] = None


class DetectionSummaryOut(BaseModel):
    total_assets: int
    critical_assets: int
    overdue_assets: int
    maintenance_due: int
    monitor_assets: int
    healthy_assets: int
    requiring_maintenance: int


class ScanResultOut(BaseModel):
    success: bool
    scan_timestamp: str
    summary: DetectionSummaryOut
    created_tasks_count: int
    updated_tasks_count: int
    active_detections: list[AssetDetectionOut] = []

