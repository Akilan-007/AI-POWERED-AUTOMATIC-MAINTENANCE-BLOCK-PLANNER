"""Analytics API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import (
    Asset, MaintenanceTask, BlockPlan, TrackSection, Train,
    Department, BlockWindow, TrainSchedule,
    AssetStatus, TaskStatus, PlanStatus,
)
from app.schemas import AnalyticsSummary

router = APIRouter()


@router.get("/analytics/summary", response_model=AnalyticsSummary)
def get_analytics_summary(db: Session = Depends(get_db)):
    """Get dashboard analytics summary computed from database."""
    # Asset metrics
    assets = db.query(Asset).all()
    total_assets = len(assets)
    avg_availability = sum(a.availability for a in assets) / max(total_assets, 1)

    assets_by_dept = {}
    assets_by_status = {}
    condition_dist = {"excellent": 0, "good": 0, "fair": 0, "poor": 0, "critical": 0}

    for a in assets:
        dept = a.department.code if a.department else "Unknown"
        assets_by_dept[dept] = assets_by_dept.get(dept, 0) + 1

        status = a.status.value if a.status else "Unknown"
        assets_by_status[status] = assets_by_status.get(status, 0) + 1

        if a.condition_score >= 90:
            condition_dist["excellent"] += 1
        elif a.condition_score >= 75:
            condition_dist["good"] += 1
        elif a.condition_score >= 60:
            condition_dist["fair"] += 1
        elif a.condition_score >= 40:
            condition_dist["poor"] += 1
        else:
            condition_dist["critical"] += 1

    # Task metrics
    tasks = db.query(MaintenanceTask).all()
    pending = sum(1 for t in tasks if t.status in [TaskStatus.PENDING, TaskStatus.OVERDUE])
    critical_tasks = sum(1 for t in tasks if t.criticality in ["Critical", "High"])

    tasks_by_priority = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    tasks_by_dept = {}
    for t in tasks:
        # Classify by score
        if t.priority >= 80:
            tasks_by_priority["Critical"] += 1
        elif t.priority >= 60:
            tasks_by_priority["High"] += 1
        elif t.priority >= 40:
            tasks_by_priority["Medium"] += 1
        else:
            tasks_by_priority["Low"] += 1

        dept = t.department.code if t.department else "Unknown"
        tasks_by_dept[dept] = tasks_by_dept.get(dept, 0) + 1

    # Block metrics
    optimized_plans = db.query(BlockPlan).filter(
        BlockPlan.plan_type == "optimized"
    ).all()
    optimized_blocks = len(optimized_plans)
    integrated_blocks = sum(1 for p in optimized_plans if p.is_integrated)
    total_disruption = sum(p.train_disruption_minutes for p in optimized_plans)

    # Planning efficiency
    total_tasks = len(tasks)
    scheduled = sum(1 for t in tasks if t.status == TaskStatus.SCHEDULED)
    efficiency = (scheduled / max(total_tasks, 1)) * 100

    total_trains = db.query(Train).count()
    total_sections = db.query(TrackSection).count()

    return AnalyticsSummary(
        asset_availability=round(avg_availability, 1),
        pending_maintenance=pending,
        critical_maintenance=critical_tasks,
        optimized_blocks=optimized_blocks,
        integrated_blocks=integrated_blocks,
        train_disruption_hours=round(total_disruption / 60, 1),
        planning_efficiency=round(efficiency, 1),
        total_assets=total_assets,
        total_trains=total_trains,
        total_sections=total_sections,
        assets_by_department=assets_by_dept,
        assets_by_status=assets_by_status,
        tasks_by_priority=tasks_by_priority,
        tasks_by_department=tasks_by_dept,
        condition_distribution=condition_dist,
    )


@router.get("/analytics/comparison")
def get_comparison_analytics(db: Session = Depends(get_db)):
    """Get baseline vs optimized comparison analytics."""
    baseline_plans = db.query(BlockPlan).filter(BlockPlan.plan_type == "baseline").all()
    optimized_plans = db.query(BlockPlan).filter(BlockPlan.plan_type == "optimized").all()

    def summarize(plans):
        return {
            "total_blocks": len(plans),
            "total_block_hours": round(
                sum(p.block_window.duration_minutes / 60 for p in plans if p.block_window), 1
            ),
            "integrated_blocks": sum(1 for p in plans if p.is_integrated),
            "train_disruption_minutes": round(
                sum(p.train_disruption_minutes for p in plans), 1
            ),
            "avg_optimization_score": round(
                sum(p.optimization_score for p in plans) / max(len(plans), 1), 1
            ),
            "tasks_scheduled": sum(len(p.block_tasks) for p in plans),
        }

    baseline = summarize(baseline_plans)
    optimized = summarize(optimized_plans)

    return {
        "baseline": baseline,
        "optimized": optimized,
        "improvement": {
            "blocks_saved": baseline["total_blocks"] - optimized["total_blocks"],
            "hours_saved": round(baseline["total_block_hours"] - optimized["total_block_hours"], 1),
            "disruption_saved_minutes": round(
                baseline["train_disruption_minutes"] - optimized["train_disruption_minutes"], 1
            ),
            "additional_integrated": optimized["integrated_blocks"] - baseline["integrated_blocks"],
        },
    }
