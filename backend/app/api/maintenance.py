"""Maintenance Tasks API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MaintenanceTask, Asset, Department, TrackSection
from app.schemas import MaintenanceTaskOut, MaintenanceTaskCreate

router = APIRouter()


@router.get("/maintenance-tasks", response_model=list[MaintenanceTaskOut])
def list_maintenance_tasks(
    department: str | None = None,
    priority_min: int | None = None,
    asset_type: str | None = None,
    section_id: int | None = None,
    status: str | None = None,
    criticality: str | None = None,
    db: Session = Depends(get_db),
):
    """List all maintenance tasks with optional filters."""
    query = db.query(MaintenanceTask)

    if department:
        query = query.join(Department).filter(Department.code == department)
    if priority_min:
        query = query.filter(MaintenanceTask.priority >= priority_min)
    if asset_type:
        query = query.join(Asset).filter(Asset.asset_type == asset_type)
    if section_id:
        query = query.filter(MaintenanceTask.section_id == section_id)
    if status:
        query = query.filter(MaintenanceTask.status == status)
    if criticality:
        query = query.filter(MaintenanceTask.criticality == criticality)

    tasks = query.order_by(MaintenanceTask.priority.desc()).all()
    result = []
    for t in tasks:
        out = MaintenanceTaskOut.model_validate(t)
        if t.asset:
            out.asset_code = t.asset.asset_code
            out.asset_name = t.asset.name
        if t.department:
            out.department_name = t.department.name
            out.department_code = t.department.code
        if t.section:
            out.section_code = t.section.section_code
        result.append(out)
    return result


@router.get("/maintenance-tasks/{task_id}", response_model=MaintenanceTaskOut)
def get_maintenance_task(task_id: int, db: Session = Depends(get_db)):
    """Get a single maintenance task."""
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")
    out = MaintenanceTaskOut.model_validate(task)
    if task.asset:
        out.asset_code = task.asset.asset_code
        out.asset_name = task.asset.name
    if task.department:
        out.department_name = task.department.name
        out.department_code = task.department.code
    if task.section:
        out.section_code = task.section.section_code
    return out


@router.post("/maintenance-tasks", response_model=MaintenanceTaskOut)
def create_maintenance_task(payload: MaintenanceTaskCreate, db: Session = Depends(get_db)):
    """Create a new maintenance task."""
    task = MaintenanceTask(
        task_code=payload.task_code,
        asset_id=payload.asset_id,
        department_id=payload.department_id,
        section_id=payload.section_id,
        maintenance_type=payload.maintenance_type,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
        criticality=payload.criticality,
        urgency=payload.urgency,
        due_date=payload.due_date,
        required_resources=payload.required_resources,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    out = MaintenanceTaskOut.model_validate(task)
    if task.asset:
        out.asset_code = task.asset.asset_code
        out.asset_name = task.asset.name
    if task.department:
        out.department_name = task.department.name
        out.department_code = task.department.code
    if task.section:
        out.section_code = task.section.section_code
    return out
