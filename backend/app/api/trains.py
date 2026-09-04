"""Trains API endpoints."""

from datetime import date as date_type
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Train, TrainSchedule, TrackSection
from app.schemas import TrainOut, TrainScheduleOut

router = APIRouter()


@router.get("/trains", response_model=list[TrainOut])
def list_trains(db: Session = Depends(get_db)):
    """List all trains."""
    trains = db.query(Train).order_by(Train.train_number).all()
    return [TrainOut.model_validate(t) for t in trains]


@router.get("/train-schedules", response_model=list[TrainScheduleOut])
def list_train_schedules(
    section_id: int | None = None,
    date: date_type | None = None,
    direction: str | None = None,
    db: Session = Depends(get_db),
):
    """List train schedules with optional filters."""
    query = db.query(TrainSchedule)
    if section_id:
        query = query.filter(TrainSchedule.section_id == section_id)
    if date:
        query = query.filter(TrainSchedule.date == date)
    if direction:
        query = query.filter(TrainSchedule.direction == direction)

    schedules = query.order_by(TrainSchedule.date, TrainSchedule.arrival_time).all()
    result = []
    for s in schedules:
        out = TrainScheduleOut.model_validate(s)
        if s.train:
            out.train_number = s.train.train_number
            out.train_name = s.train.train_name
        if s.section:
            out.section_code = s.section.section_code
        result.append(out)
    return result
