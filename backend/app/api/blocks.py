"""Blocks API endpoints."""

from datetime import date as date_type
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BlockWindow, BlockPlan, BlockTask, TrackSection, MaintenanceTask
from app.schemas import BlockWindowOut, BlockPlanOut, BlockTaskOut

router = APIRouter()


@router.get("/block-windows", response_model=list[BlockWindowOut])
def list_block_windows(
    section_id: int | None = None,
    date: date_type | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """List available block windows."""
    query = db.query(BlockWindow)
    if section_id:
        query = query.filter(BlockWindow.section_id == section_id)
    if date:
        query = query.filter(BlockWindow.date == date)
    if status:
        query = query.filter(BlockWindow.status == status)

    windows = query.order_by(BlockWindow.date, BlockWindow.start_time).all()
    result = []
    for w in windows:
        out = BlockWindowOut.model_validate(w)
        out.section_code = w.section.section_code if w.section else None
        out.duration_minutes = w.duration_minutes
        result.append(out)
    return result


@router.get("/block-plans", response_model=list[BlockPlanOut])
def list_block_plans(
    plan_type: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """List all block plans."""
    query = db.query(BlockPlan)
    if plan_type:
        query = query.filter(BlockPlan.plan_type == plan_type)
    if status:
        query = query.filter(BlockPlan.status == status)

    plans = query.order_by(BlockPlan.plan_date).all()
    result = []
    for p in plans:
        out = BlockPlanOut.model_validate(p)
        if p.block_window and p.block_window.section:
            out.section_code = p.block_window.section.section_code
            out.window_start = p.block_window.start_time
            out.window_end = p.block_window.end_time
        out.block_tasks = []
        for bt in p.block_tasks:
            bt_out = BlockTaskOut.model_validate(bt)
            if bt.maintenance_task:
                bt_out.task_code = bt.maintenance_task.task_code
                bt_out.task_description = bt.maintenance_task.description
            out.block_tasks.append(bt_out)
        result.append(out)
    return result
