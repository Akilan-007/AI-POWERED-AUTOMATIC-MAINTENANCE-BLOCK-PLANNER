"""Planning API endpoints - core block planning functionality."""

from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    PlanningRequest, OptimizationResult, ComparisonResult,
    TaskCandidates, PriorityResult, WeeklyPlanOut, MonthlyPlanOut,
    DayPlan, BlockPlanOut, BlockTaskOut, ValidationResult,
)
from app.services.ai.priority_engine import compute_all_priorities
from app.services.planning.candidate_generator import generate_all_candidates, generate_candidates_for_task
from app.services.optimization.cpsat_optimizer import BlockPlanOptimizer, BaselinePlanner
from app.models import (
    MaintenanceTask, BlockPlan, BlockTask, BlockWindow,
    TaskStatus, PlanStatus,
)

router = APIRouter()


@router.post("/planning/priorities", response_model=list[PriorityResult])
def compute_priorities(db: Session = Depends(get_db)):
    """Compute AI-driven priorities for all pending maintenance tasks."""
    results = compute_all_priorities(db)
    return [PriorityResult(**r) for r in results]


@router.post("/planning/candidates", response_model=list[TaskCandidates])
def generate_candidates(request: PlanningRequest, db: Session = Depends(get_db)):
    """Generate candidate block windows for all pending tasks."""
    results = generate_all_candidates(db, request.start_date, request.end_date)
    return [TaskCandidates(**r) for r in results]


@router.post("/planning/generate", response_model=OptimizationResult)
def generate_optimized_plan(request: PlanningRequest, db: Session = Depends(get_db)):
    """Generate an optimized block plan using OR-Tools CP-SAT."""
    # First compute priorities
    compute_all_priorities(db)

    # Then optimize
    optimizer = BlockPlanOptimizer(db)
    result = optimizer.optimize(request.start_date, request.end_date, request.task_ids)
    return OptimizationResult(**result)


@router.post("/planning/baseline", response_model=OptimizationResult)
def generate_baseline_plan(request: PlanningRequest, db: Session = Depends(get_db)):
    """Generate a baseline plan using simple first-fit scheduling."""
    planner = BaselinePlanner(db)
    result = planner.plan(request.start_date, request.end_date, request.task_ids)
    return OptimizationResult(**result)


@router.post("/planning/compare", response_model=ComparisonResult)
def compare_plans(request: PlanningRequest, db: Session = Depends(get_db)):
    """Compare baseline vs optimized planning."""
    # Reset task statuses for fair comparison
    tasks = db.query(MaintenanceTask).filter(
        MaintenanceTask.status.in_([TaskStatus.PENDING, TaskStatus.OVERDUE, TaskStatus.SCHEDULED])
    ).all()
    for t in tasks:
        if t.status == TaskStatus.SCHEDULED:
            t.status = TaskStatus.PENDING
    db.commit()

    # Compute priorities first
    compute_all_priorities(db)

    # Generate baseline
    baseline_planner = BaselinePlanner(db)
    baseline_result = baseline_planner.plan(request.start_date, request.end_date, request.task_ids)

    # Reset statuses again
    for t in tasks:
        if t.status == TaskStatus.SCHEDULED:
            t.status = TaskStatus.PENDING
    db.commit()

    # Compute priorities again
    compute_all_priorities(db)

    # Generate optimized
    optimizer = BlockPlanOptimizer(db)
    optimized_result = optimizer.optimize(request.start_date, request.end_date, request.task_ids)

    # Calculate improvements
    improvement = {}
    if baseline_result["total_blocks"] > 0:
        improvement["blocks_reduction"] = baseline_result["total_blocks"] - optimized_result["total_blocks"]
        improvement["block_hours_reduction"] = round(
            baseline_result["total_block_hours"] - optimized_result["total_block_hours"], 1
        )
        improvement["disruption_reduction"] = round(
            baseline_result["train_disruption_minutes"] - optimized_result["train_disruption_minutes"], 1
        )
        improvement["additional_integrated_blocks"] = (
            optimized_result["integrated_blocks"] - baseline_result["integrated_blocks"]
        )
        improvement["availability_improvement"] = round(
            optimized_result["asset_availability_improvement"] - baseline_result["asset_availability_improvement"], 2
        )
        improvement["score_improvement"] = round(
            optimized_result["optimization_score"] - baseline_result["optimization_score"], 1
        )

    return ComparisonResult(
        baseline=OptimizationResult(**baseline_result),
        optimized=OptimizationResult(**optimized_result),
        improvement=improvement,
    )


@router.post("/planning/validate")
def validate_assignment(
    task_id: int,
    window_id: int,
    db: Session = Depends(get_db),
):
    """Validate a specific task-window assignment."""
    from app.services.constraints.constraint_engine import ConstraintValidationService

    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    window = db.query(BlockWindow).filter(BlockWindow.id == window_id).first()

    if not task or not window:
        return ValidationResult(feasible=False, violations=["Task or window not found"], score=0)

    validator = ConstraintValidationService(db)
    return validator.validate(task, window)


@router.get("/plans/weekly", response_model=WeeklyPlanOut)
def get_weekly_plan(
    plan_type: str = "optimized",
    db: Session = Depends(get_db),
):
    """Get the weekly plan view."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)

    plans = (
        db.query(BlockPlan)
        .filter(
            BlockPlan.plan_date >= monday,
            BlockPlan.plan_date <= sunday,
            BlockPlan.plan_type == plan_type,
        )
        .order_by(BlockPlan.plan_date)
        .all()
    )

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    days = []

    for i in range(7):
        current_date = monday + timedelta(days=i)
        day_plans = [p for p in plans if p.plan_date == current_date]

        plan_outs = []
        for p in day_plans:
            pout = BlockPlanOut.model_validate(p)
            if p.block_window and p.block_window.section:
                pout.section_code = p.block_window.section.section_code
                pout.window_start = p.block_window.start_time
                pout.window_end = p.block_window.end_time
            pout.block_tasks = []
            for bt in p.block_tasks:
                btout = BlockTaskOut.model_validate(bt)
                if bt.maintenance_task:
                    btout.task_code = bt.maintenance_task.task_code
                    btout.task_description = bt.maintenance_task.description
                pout.block_tasks.append(btout)
            plan_outs.append(pout)

        total_hours = sum(
            p.block_window.duration_minutes / 60
            for p in day_plans if p.block_window
        )

        days.append(DayPlan(
            date=current_date,
            day_name=day_names[i],
            blocks=plan_outs,
            total_tasks=sum(len(p.block_tasks) for p in day_plans),
            total_block_hours=round(total_hours, 1),
        ))

    summary = {
        "total_blocks": sum(len(d.blocks) for d in days),
        "total_tasks": sum(d.total_tasks for d in days),
        "total_block_hours": round(sum(d.total_block_hours for d in days), 1),
        "integrated_blocks": sum(
            1 for p in plans if p.is_integrated
        ),
    }

    return WeeklyPlanOut(
        week_start=monday,
        week_end=sunday,
        days=days,
        summary=summary,
    )


@router.get("/plans/monthly", response_model=MonthlyPlanOut)
def get_monthly_plan(
    plan_type: str = "optimized",
    db: Session = Depends(get_db),
):
    """Get the monthly plan summary."""
    today = date.today()
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        month_end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)

    all_tasks = db.query(MaintenanceTask).all()
    plans = db.query(BlockPlan).filter(
        BlockPlan.plan_date >= month_start,
        BlockPlan.plan_date <= month_end,
        BlockPlan.plan_type == plan_type,
    ).all()

    total_tasks = len(all_tasks)
    completed = sum(1 for t in all_tasks if t.status.value == "Completed")
    pending = sum(1 for t in all_tasks if t.status.value in ["Pending", "Overdue"])
    critical = sum(1 for t in all_tasks if t.criticality in ["Critical", "High"])

    total_blocks = len(plans)
    integrated = sum(1 for p in plans if p.is_integrated)

    avg_avail = sum(
        p.asset_availability_impact for p in plans
    ) / max(len(plans), 1) * 100

    total_disruption = sum(p.train_disruption_minutes for p in plans)

    return MonthlyPlanOut(
        month=today.month,
        year=today.year,
        total_tasks=total_tasks,
        completed_tasks=completed,
        pending_tasks=pending,
        critical_tasks=critical,
        total_blocks=total_blocks,
        integrated_blocks=integrated,
        estimated_availability=round(85 + avg_avail, 1),  # Base + improvement
        estimated_disruption=round(total_disruption / 60, 1),
        weeks=[],
    )
