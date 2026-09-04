"""Assets API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Asset, Department, TrackSection, MaintenanceHistory
from app.schemas import AssetOut, MaintenanceHistoryOut

router = APIRouter()


@router.get("/assets", response_model=list[AssetOut])
def list_assets(
    department: str | None = None,
    asset_type: str | None = None,
    section_id: int | None = None,
    status: str | None = None,
    criticality: str | None = None,
    db: Session = Depends(get_db),
):
    """List all assets with optional filters."""
    query = db.query(Asset)

    if department:
        query = query.join(Department).filter(Department.code == department)
    if asset_type:
        query = query.filter(Asset.asset_type == asset_type)
    if section_id:
        query = query.filter(Asset.section_id == section_id)
    if status:
        query = query.filter(Asset.status == status)
    if criticality:
        query = query.filter(Asset.criticality == criticality)

    assets = query.all()
    result = []
    for a in assets:
        out = AssetOut.model_validate(a)
        out.department_name = a.department.name if a.department else None
        out.section_code = a.section.section_code if a.section else None
        result.append(out)
    return result


@router.get("/assets/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    """Get a single asset by ID."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    out = AssetOut.model_validate(asset)
    out.department_name = asset.department.name if asset.department else None
    out.section_code = asset.section.section_code if asset.section else None
    return out


@router.get("/assets/{asset_id}/history", response_model=list[MaintenanceHistoryOut])
def get_asset_history(asset_id: int, db: Session = Depends(get_db)):
    """Get maintenance history for an asset."""
    records = (
        db.query(MaintenanceHistory)
        .filter(MaintenanceHistory.asset_id == asset_id)
        .order_by(MaintenanceHistory.completed_date.desc())
        .all()
    )
    result = []
    for r in records:
        out = MaintenanceHistoryOut.model_validate(r)
        out.asset_code = r.asset.asset_code if r.asset else None
        result.append(out)
    return result
