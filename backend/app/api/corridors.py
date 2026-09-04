"""Corridors API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Corridor, TrackSection, Department
from app.schemas import CorridorOut, TrackSectionOut, DepartmentOut

router = APIRouter()


@router.get("/corridors", response_model=list[CorridorOut])
def list_corridors(db: Session = Depends(get_db)):
    """List all corridors with their track sections."""
    corridors = db.query(Corridor).all()
    return [CorridorOut.model_validate(c) for c in corridors]


@router.get("/track-sections", response_model=list[TrackSectionOut])
def list_track_sections(db: Session = Depends(get_db)):
    """List all track sections."""
    sections = db.query(TrackSection).all()
    return [TrackSectionOut.model_validate(s) for s in sections]


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    """List all departments."""
    depts = db.query(Department).all()
    return [DepartmentOut.model_validate(d) for d in depts]
