"""Active Maintenance Detection API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import AssetDetectionOut, DetectionSummaryOut, ScanResultOut
from app.services.assets.detection_service import ActiveMaintenanceDetectionService

router = APIRouter()


@router.get("/maintenance-detection", response_model=List[AssetDetectionOut])
def list_all_detections(db: Session = Depends(get_db)):
    """Return all assets and their current active maintenance detection status."""
    service = ActiveMaintenanceDetectionService(db)
    results = service.detect_all(active_only=False)
    return [AssetDetectionOut(**r) for r in results]


@router.get("/maintenance-detection/active", response_model=List[AssetDetectionOut])
def list_active_detections(db: Session = Depends(get_db)):
    """Return only assets currently requiring maintenance."""
    service = ActiveMaintenanceDetectionService(db)
    results = service.detect_all(active_only=True)
    return [AssetDetectionOut(**r) for r in results]


@router.get("/maintenance-detection/summary", response_model=DetectionSummaryOut)
def get_detection_summary(db: Session = Depends(get_db)):
    """Return counts of total, critical, overdue, maintenance due, monitor, and healthy assets."""
    service = ActiveMaintenanceDetectionService(db)
    summary = service.get_summary()
    return DetectionSummaryOut(**summary)


@router.post("/maintenance-detection/scan", response_model=ScanResultOut)
def scan_and_detect_maintenance(db: Session = Depends(get_db)):
    """
    Simulate an active asset health scan across the corridor.
    Evaluates condition scores, due dates, availability, and criticality,
    updates/creates maintenance tasks, and returns detection results.
    """
    service = ActiveMaintenanceDetectionService(db)
    result = service.scan_and_sync()
    return ScanResultOut(**result)
