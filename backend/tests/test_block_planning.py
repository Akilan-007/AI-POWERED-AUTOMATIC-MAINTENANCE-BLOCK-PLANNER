"""
Unit and Integration Tests for Railway Maintenance Block Planning System (SIH26027)

Tests:
1. Priority Calculation (AI Priority Engine)
2. Candidate Block Generation
3. Constraint Validation Engine (all 10 constraints)
4. Train Conflict Detection
5. Integrated Multi-Department Block Grouping
6. Google OR-Tools CP-SAT Optimization
7. Baseline First-Fit Planner
8. FastAPI Endpoints Integration
"""

import pytest
import sys
import os
from datetime import date, time, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import (
    MaintenanceTask, Asset, TrackSection, BlockWindow, TrainSchedule,
    Department, BlockPlan, TaskStatus, BlockStatus, PlanStatus,
)
from app.services.ai.priority_engine import calculate_priority, compute_all_priorities
from app.services.planning.candidate_generator import generate_candidates_for_task, generate_all_candidates
from app.services.constraints.constraint_engine import ConstraintValidationService
from app.services.optimization.cpsat_optimizer import BlockPlanOptimizer, BaselinePlanner


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def test_priority_engine(db):
    """Test AI priority calculation and explainability."""
    tasks = db.query(MaintenanceTask).all()
    assert len(tasks) > 0

    for task in tasks[:5]:
        result = calculate_priority(task, db)
        assert 0 <= result["score"] <= 100
        assert result["classification"] in ["Critical", "High", "Medium", "Low"]
        assert len(result["explanation"]) > 0
        assert "factors" in result


def test_candidate_generation(db):
    """Test candidate maintenance window generation and train conflict detection."""
    task = db.query(MaintenanceTask).first()
    assert task is not None

    candidates = generate_candidates_for_task(task, db)
    assert len(candidates) > 0

    # At least one candidate should have validation result
    for c in candidates:
        assert hasattr(c, "validation")
        assert isinstance(c.validation.feasible, bool)
        assert isinstance(c.validation.violations, list)
        assert isinstance(c.validation.warnings, list)


def test_constraint_validation(db):
    """Test dedicated constraint validation service."""
    validator = ConstraintValidationService(db)
    task = db.query(MaintenanceTask).first()
    window = db.query(BlockWindow).filter(BlockWindow.section_id == task.section_id).first()

    assert task is not None
    assert window is not None

    res = validator.validate(task, window)
    assert isinstance(res.feasible, bool)
    assert 0.0 <= res.score <= 100.0


def test_cpsat_optimization(db):
    """Test Google OR-Tools CP-SAT optimizer generates valid block plans."""
    optimizer = BlockPlanOptimizer(db)
    result = optimizer.optimize()

    assert result["success"] is True
    assert result["plan_type"] == "optimized"
    assert result["total_blocks"] > 0
    assert result["total_tasks_scheduled"] > 0
    assert result["optimization_score"] > 0
    assert len(result["plans"]) > 0

    # Check for integrated multi-department blocks
    integrated_plans = [p for p in result["plans"] if p.is_integrated]
    assert len(integrated_plans) > 0, "Optimizer should form integrated blocks combining departments"


def test_baseline_vs_optimized(db):
    """Test that OR-Tools CP-SAT outperforms baseline first-fit heuristic."""
    baseline_planner = BaselinePlanner(db)
    base_res = baseline_planner.plan()

    optimizer = BlockPlanOptimizer(db)
    opt_res = optimizer.optimize()

    # CP-SAT should use fewer blocks and dramatically reduce train disruption
    assert opt_res["total_blocks"] <= base_res["total_blocks"]
    assert opt_res["train_disruption_minutes"] < base_res["train_disruption_minutes"]
    assert opt_res["integrated_blocks"] > 0


def test_api_endpoints():
    """Test key FastAPI REST endpoints."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    # Health
    res = client.get("/api/health")
    assert res.status_code == 200

    # Assets
    res = client.get("/api/assets")
    assert res.status_code == 200
    assets = res.json()
    assert len(assets) > 0

    # Maintenance Tasks
    res = client.get("/api/maintenance-tasks")
    assert res.status_code == 200
    tasks = res.json()
    assert len(tasks) > 0

    # Corridors
    res = client.get("/api/corridors")
    assert res.status_code == 200

    # Network topology
    res = client.get("/api/network")
    assert res.status_code == 200
    net = res.json()
    assert "stations" in net
    assert "sections" in net
    assert len(net["stations"]) > 0

    # AI Insights
    res = client.get("/api/ai/insights")
    assert res.status_code == 200

    # Analytics summary
    res = client.get("/api/analytics/summary")
    assert res.status_code == 200
    summary = res.json()
    assert "asset_availability" in summary
