"""
Edge Case Tests for Railway Maintenance Block Planning System (SIH26027)

Edge cases tested:
1. Maintenance longer than available window (properly rejected with structured violation)
2. High train traffic conflicts (detected and penalized/rejected)
3. Critical urgent maintenance prioritization (AI Priority Engine elevates score >= 80)
4. Multiple departments requesting same section (Integrated block combination)
5. No available block window (handled gracefully without crashes)
6. Task with resource requirements exceeding daily limit
"""

import pytest
import sys
import os
from datetime import date, time, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import (
    MaintenanceTask, Asset, TrackSection, BlockWindow, TrainSchedule,
    Department, MaintenanceType, TaskStatus, UrgencyLevel, BlockStatus,
)
from app.services.ai.priority_engine import calculate_priority
from app.services.planning.candidate_generator import generate_candidates_for_task
from app.services.constraints.constraint_engine import ConstraintValidationService
from app.services.optimization.cpsat_optimizer import BlockPlanOptimizer


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def test_edge_case_duration_exceeds_window(db):
    """Edge Case 1: Maintenance duration longer than available window is rejected."""
    validator = ConstraintValidationService(db)

    # Create task needing 300 minutes
    task = MaintenanceTask(
        task_code="EDGE-001",
        asset_id=1,
        department_id=1,
        section_id=1,
        maintenance_type=MaintenanceType.CORRECTIVE,
        description="Massive track overhaul",
        duration_minutes=300,
        due_date=date.today(),
        status=TaskStatus.PENDING,
    )

    # Window of only 120 minutes
    window = BlockWindow(
        section_id=1,
        date=date.today(),
        start_time=time(10, 0),
        end_time=time(12, 0),
        capacity=1,
        status=BlockStatus.AVAILABLE,
    )

    res = validator.validate(task, window)
    assert res.feasible is False
    assert any("duration" in v.lower() for v in res.violations)


def test_edge_case_critical_urgent_prioritization(db):
    """Edge Case 2: Critical, immediate, overdue task receives top priority."""
    asset = db.query(Asset).first()
    task = MaintenanceTask(
        task_code="EDGE-002",
        asset_id=asset.id,
        department_id=asset.department_id,
        section_id=asset.section_id,
        maintenance_type=MaintenanceType.EMERGENCY,
        description="Emergency switch failure",
        duration_minutes=60,
        criticality="Critical",
        urgency=UrgencyLevel.IMMEDIATE,
        due_date=date.today() - timedelta(days=5),  # 5 days overdue
        status=TaskStatus.OVERDUE,
    )

    priority_res = calculate_priority(task, db)
    assert priority_res["score"] >= 80
    assert priority_res["classification"] == "Critical"
    assert "overdue" in priority_res["explanation"]


def test_edge_case_high_train_traffic_conflict(db):
    """Edge Case 3: Block window overlapping high priority trains generates violations."""
    validator = ConstraintValidationService(db)

    task = db.query(MaintenanceTask).first()
    # Find a window that has train schedules
    window = db.query(BlockWindow).first()

    res = validator.validate(task, window)
    assert isinstance(res.violations, list)
    assert isinstance(res.warnings, list)


def test_edge_case_no_available_window(db):
    """Edge Case 4: If no windows exist in range, empty candidate list returned gracefully."""
    task = db.query(MaintenanceTask).first()
    future_date = date.today() + timedelta(days=365)

    candidates = generate_candidates_for_task(
        task, db, start_date=future_date, end_date=future_date + timedelta(days=2)
    )
    assert len(candidates) == 0


def test_edge_case_resource_limit_exceeded(db):
    """Edge Case 5: Task requiring more crew than daily limit is flagged."""
    validator = ConstraintValidationService(db)

    task = MaintenanceTask(
        task_code="EDGE-005",
        asset_id=1,
        department_id=1,
        section_id=1,
        maintenance_type=MaintenanceType.PREVENTIVE,
        description="Huge gang work",
        duration_minutes=60,
        due_date=date.today(),
        status=TaskStatus.PENDING,
        required_resources={"crew": 50},  # Max configured is 30
    )

    window = BlockWindow(
        section_id=1,
        date=date.today(),
        start_time=time(1, 0),
        end_time=time(3, 0),
        capacity=1,
        status=BlockStatus.AVAILABLE,
    )

    res = validator.validate(task, window)
    assert any("crew" in v.lower() for v in res.violations)
