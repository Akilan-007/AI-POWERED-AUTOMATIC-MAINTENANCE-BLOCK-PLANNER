"""
Tests for Active Maintenance Detection Service (SIH26027)

Tests:
1. Healthy asset evaluation
2. Maintenance due evaluation
3. Overdue maintenance evaluation
4. Critical condition evaluation (<40 score)
5. Low availability evaluation (<65% availability)
6. High criticality combined with overdue
7. Multiple detection factors & explainable reasons
8. Duplicate task prevention on scan
9. End-to-end integration: Detection -> Maintenance Task -> AI Priority Engine -> Planning workflow
"""

import pytest
import sys
import os
from datetime import date, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import Asset, MaintenanceTask, AssetType, CriticalityLevel, AssetStatus, TaskStatus
from app.services.assets.detection_service import ActiveMaintenanceDetectionService, DetectionThresholds
from app.services.ai.priority_engine import calculate_priority
from app.services.optimization.cpsat_optimizer import BlockPlanOptimizer


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def test_detect_healthy_asset(db):
    """Asset with high condition, high availability, far due date is HEALTHY."""
    service = ActiveMaintenanceDetectionService(db)
    asset = Asset(
        asset_code="TEST-HEALTHY",
        name="Healthy Track Segment",
        asset_type=AssetType.TRACK,
        department_id=1,
        section_id=1,
        criticality=CriticalityLevel.LOW,
        condition_score=92.0,
        availability=99.0,
        status=AssetStatus.OPERATIONAL,
        next_due_date=date.today() + timedelta(days=45),
    )
    res = service.evaluate_asset(asset)
    assert res["maintenance_status"] == "HEALTHY"
    assert res["maintenance_required"] is False
    assert res["detection_score"] <= 30
    assert any("normal" in r.lower() or "tolerances" in r.lower() for r in res["reasons"])


def test_detect_critical_condition(db):
    """Asset with condition < 40 is detected as CRITICAL."""
    service = ActiveMaintenanceDetectionService(db)
    asset = Asset(
        asset_code="TEST-CRIT-COND",
        name="Worn Track",
        asset_type=AssetType.TRACK,
        department_id=1,
        section_id=1,
        criticality=CriticalityLevel.HIGH,
        condition_score=35.0,  # Below 40
        availability=85.0,
        status=AssetStatus.DEGRADED,
        next_due_date=date.today() + timedelta(days=10),
    )
    res = service.evaluate_asset(asset)
    assert res["maintenance_status"] == "CRITICAL"
    assert res["maintenance_required"] is True
    assert res["detection_score"] >= 80
    assert any("condition" in r.lower() and "critical" in r.lower() for r in res["reasons"])


def test_detect_overdue_maintenance(db):
    """Asset with next_due_date in past is detected as OVERDUE."""
    service = ActiveMaintenanceDetectionService(db)
    asset = Asset(
        asset_code="TEST-OVERDUE",
        name="Signal Overdue",
        asset_type=AssetType.SIGNAL,
        department_id=3,
        section_id=1,
        criticality=CriticalityLevel.MEDIUM,
        condition_score=68.0,
        availability=88.0,
        status=AssetStatus.OPERATIONAL,
        next_due_date=date.today() - timedelta(days=5),
    )
    res = service.evaluate_asset(asset)
    assert res["maintenance_status"] in ["OVERDUE", "CRITICAL"]
    assert res["maintenance_required"] is True
    assert any("overdue" in r.lower() for r in res["reasons"])


def test_detect_maintenance_due(db):
    """Asset with condition < 60 and due in <= 7 days is MAINTENANCE_DUE."""
    service = ActiveMaintenanceDetectionService(db)
    asset = Asset(
        asset_code="TEST-DUE",
        name="OHE Inspection Due",
        asset_type=AssetType.OHE,
        department_id=2,
        section_id=1,
        criticality=CriticalityLevel.MEDIUM,
        condition_score=58.0,
        availability=82.0,
        status=AssetStatus.OPERATIONAL,
        next_due_date=date.today() + timedelta(days=3),
    )
    res = service.evaluate_asset(asset)
    assert res["maintenance_status"] == "MAINTENANCE_DUE"
    assert res["maintenance_required"] is True
    assert any("due in 3 days" in r.lower() or "scheduled maintenance" in r.lower() for r in res["reasons"])


def test_detect_low_availability(db):
    """Asset with availability < 65% triggers CRITICAL requirement."""
    service = ActiveMaintenanceDetectionService(db)
    asset = Asset(
        asset_code="TEST-LOW-AVAIL",
        name="Intermittent Substation",
        asset_type=AssetType.SUBSTATION,
        department_id=2,
        section_id=1,
        criticality=CriticalityLevel.HIGH,
        condition_score=70.0,
        availability=55.0,  # Critically low availability
        status=AssetStatus.DEGRADED,
        next_due_date=date.today() + timedelta(days=20),
    )
    res = service.evaluate_asset(asset)
    assert res["maintenance_status"] == "CRITICAL"
    assert res["maintenance_required"] is True
    assert any("availability" in r.lower() for r in res["reasons"])


def test_scan_duplicate_task_prevention(db):
    """Running scan_and_sync twice should NOT create duplicate tasks for the same asset."""
    service = ActiveMaintenanceDetectionService(db)
    
    # Run scan 1
    scan1 = service.scan_and_sync()
    initial_tasks_count = db.query(MaintenanceTask).count()
    
    # Run scan 2
    scan2 = service.scan_and_sync()
    second_tasks_count = db.query(MaintenanceTask).count()
    
    # No duplicate tasks created
    assert scan2["created_tasks_count"] == 0
    assert second_tasks_count == initial_tasks_count


def test_detection_to_planning_pipeline(db):
    """Test full integration: detected asset generates task, AI priority scores it, CP-SAT optimizer schedules it."""
    service = ActiveMaintenanceDetectionService(db)
    scan_res = service.scan_and_sync()
    assert scan_res["success"] is True

    # Find a detected task
    tk14_task = (
        db.query(MaintenanceTask)
        .join(Asset)
        .filter(Asset.asset_code == "TK-014")
        .first()
    )
    assert tk14_task is not None

    # Verify AI Priority Engine scores it
    priority_res = calculate_priority(tk14_task, db)
    assert priority_res["score"] >= 80
    assert priority_res["classification"] in ["Critical", "High"]

    # Verify CP-SAT Optimizer schedules it
    optimizer = BlockPlanOptimizer(db)
    opt_result = optimizer.optimize()
    assert opt_result["success"] is True
    assert opt_result["total_tasks_scheduled"] > 0
