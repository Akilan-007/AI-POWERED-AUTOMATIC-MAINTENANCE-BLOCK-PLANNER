"""AI Insights API endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    MaintenanceTask, Asset, BlockPlan, BlockTask,
    TaskStatus, PlanStatus, AssetStatus,
)
from app.schemas import InsightOut

router = APIRouter()


@router.get("/ai/insights", response_model=list[InsightOut])
def get_ai_insights(db: Session = Depends(get_db)):
    """Generate explainable AI insights based on actual data and optimization results."""
    insights = []

    # 1. Overdue critical tasks
    overdue_tasks = db.query(MaintenanceTask).filter(
        MaintenanceTask.status == TaskStatus.OVERDUE,
    ).all()

    for task in overdue_tasks:
        from datetime import date
        days_overdue = (date.today() - task.due_date).days if task.due_date else 0
        insights.append(InsightOut(
            type="priority",
            severity="critical" if task.criticality in ["Critical", "High"] else "warning",
            message=(
                f"Asset {task.asset.asset_code if task.asset else 'N/A'} maintenance ({task.task_code}) "
                f"is overdue by {days_overdue} days. Priority score: {task.priority}. "
                f"{task.priority_explanation or ''}"
            ),
            related_task=task.task_code,
            related_asset=task.asset.asset_code if task.asset else None,
            related_section=task.section.section_code if task.section else None,
        ))

    # 2. Degraded/failed assets
    degraded_assets = db.query(Asset).filter(
        Asset.status.in_([AssetStatus.DEGRADED, AssetStatus.FAILED])
    ).all()

    for asset in degraded_assets:
        insights.append(InsightOut(
            type="recommendation",
            severity="critical" if asset.status == AssetStatus.FAILED else "warning",
            message=(
                f"Asset {asset.asset_code} ({asset.name}) is {asset.status.value}. "
                f"Condition score: {asset.condition_score}/100. "
                f"Availability: {asset.availability}%. Immediate maintenance recommended."
            ),
            related_asset=asset.asset_code,
            related_section=asset.section.section_code if asset.section else None,
        ))

    # 3. Integrated block insights
    integrated_plans = db.query(BlockPlan).filter(
        BlockPlan.is_integrated == 1,
        BlockPlan.plan_type == "optimized",
    ).all()

    for plan in integrated_plans:
        depts = ", ".join(plan.departments_involved) if plan.departments_involved else "multiple"
        task_count = len(plan.block_tasks)
        insights.append(InsightOut(
            type="grouping",
            severity="info",
            message=(
                f"{task_count} compatible maintenance activities from {depts} departments "
                f"were combined into one integrated block on {plan.plan_date} "
                f"({plan.block_window.start_time.strftime('%H:%M')}-"
                f"{plan.block_window.end_time.strftime('%H:%M')} on "
                f"{plan.block_window.section.section_code if plan.block_window and plan.block_window.section else 'N/A'}), "
                f"reducing corridor closures."
            ),
            related_section=(
                plan.block_window.section.section_code
                if plan.block_window and plan.block_window.section else None
            ),
        ))

    # 4. Optimization decisions
    optimized_plans = db.query(BlockPlan).filter(
        BlockPlan.plan_type == "optimized",
        BlockPlan.reasoning.isnot(None),
    ).all()

    for plan in optimized_plans[:5]:  # Limit to top 5
        if plan.train_disruption_minutes > 0:
            insights.append(InsightOut(
                type="conflict",
                severity="info",
                message=(
                    f"Block on {plan.plan_date} "
                    f"({plan.block_window.start_time.strftime('%H:%M')}-"
                    f"{plan.block_window.end_time.strftime('%H:%M')}) "
                    f"was selected with {plan.train_disruption_minutes:.0f}min estimated disruption. "
                    f"This window was chosen because alternative windows had higher conflicts."
                ),
                related_section=(
                    plan.block_window.section.section_code
                    if plan.block_window and plan.block_window.section else None
                ),
            ))

    # 5. High priority unscheduled tasks
    high_priority_pending = db.query(MaintenanceTask).filter(
        MaintenanceTask.status.in_([TaskStatus.PENDING, TaskStatus.OVERDUE]),
        MaintenanceTask.priority >= 70,
    ).all()

    for task in high_priority_pending[:3]:
        insights.append(InsightOut(
            type="recommendation",
            severity="warning",
            message=(
                f"High-priority task {task.task_code} (priority: {task.priority}) "
                f"for asset {task.asset.asset_code if task.asset else 'N/A'} "
                f"has not been scheduled yet. Consider running optimization."
            ),
            related_task=task.task_code,
            related_asset=task.asset.asset_code if task.asset else None,
        ))

    return insights
