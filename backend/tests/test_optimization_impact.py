import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from app.main import app


def compute_impact(baseline: float, optimized: float, is_higher_better: bool) -> dict:
    """Python reference implementation of the Optimization Impact calculation logic."""
    if is_higher_better:
        diff = optimized - baseline
        pct = 0.0
        if baseline > 0:
            pct = round(((optimized - baseline) / baseline) * 100, 1)
        elif optimized > 0:
            pct = 100.0
        else:
            pct = 0.0

        if diff > 0:
            return {
                "pct": abs(pct),
                "arrow": "↑",
                "is_improved": True,
                "display": f"↑ +{abs(pct):.1f}%",
            }
        elif diff < 0:
            return {
                "pct": abs(pct),
                "arrow": "↓",
                "is_improved": False,
                "display": f"↓ -{abs(pct):.1f}%",
            }
        else:
            return {
                "pct": 0.0,
                "arrow": "↑",
                "is_improved": True,
                "display": "↑ 0.0%",
            }
    else:
        reduction = baseline - optimized
        pct = 0.0
        if baseline > 0:
            pct = round(((baseline - optimized) / baseline) * 100, 1)
        elif optimized == 0:
            pct = 0.0
        else:
            pct = -100.0

        if reduction > 0:
            return {
                "pct": abs(pct),
                "arrow": "↓",
                "is_improved": True,
                "display": f"↓ {abs(pct):.1f}%",
            }
        elif reduction < 0:
            return {
                "pct": abs(pct),
                "arrow": "↑",
                "is_improved": False,
                "display": f"↑ +{abs(pct):.1f}%",
            }
        else:
            return {
                "pct": 0.0,
                "arrow": "↓",
                "is_improved": True,
                "display": "↓ 0.0%",
            }


def test_comparison_api_response():
    """Verify that /api/analytics/comparison contains all 6 required metrics."""
    client = TestClient(app)
    response = client.get("/api/analytics/comparison")
    assert response.status_code == 200
    data = response.json()

    assert "baseline" in data
    assert "optimized" in data
    assert "improvement" in data

    b = data["baseline"]
    o = data["optimized"]

    # 1. Maintenance Completion
    assert "maintenance_completion_rate" in b
    assert "maintenance_completion_rate" in o
    assert 0 <= b["maintenance_completion_rate"] <= 100
    assert 0 <= o["maintenance_completion_rate"] <= 100

    # 2. Asset Availability
    assert "asset_availability" in b
    assert "asset_availability" in o
    assert 0 <= b["asset_availability"] <= 100
    assert 0 <= o["asset_availability"] <= 100

    # 3. Train Disruption
    assert "train_disruption_minutes" in b
    assert "train_disruption_minutes" in o
    assert b["train_disruption_minutes"] >= 0
    assert o["train_disruption_minutes"] >= 0

    # 4. Corridor Block Time
    assert "total_block_hours" in b
    assert "total_block_hours" in o
    assert b["total_block_hours"] >= 0
    assert o["total_block_hours"] >= 0

    # 5. Separate Blocks
    assert "total_blocks" in b
    assert "total_blocks" in o
    assert b["total_blocks"] >= 0
    assert o["total_blocks"] >= 0

    # 6. Integrated Blocks
    assert "integrated_blocks" in b
    assert "integrated_blocks" in o
    assert b["integrated_blocks"] >= 0
    assert o["integrated_blocks"] >= 0


def test_increase_is_better_calculation():
    """Test higher-is-better metrics (Maintenance Completion, Asset Availability, Integrated Blocks)."""
    # Asset Availability improvement
    res_avail = compute_impact(baseline=92.5, optimized=99.9, is_higher_better=True)
    assert res_avail["arrow"] == "↑"
    assert res_avail["is_improved"] is True
    assert res_avail["pct"] == 8.0
    assert res_avail["display"] == "↑ +8.0%"

    # Integrated Blocks improvement
    res_int = compute_impact(baseline=10, optimized=11, is_higher_better=True)
    assert res_int["arrow"] == "↑"
    assert res_int["is_improved"] is True
    assert res_int["pct"] == 10.0
    assert res_int["display"] == "↑ +10.0%"

    # Maintenance Completion equal (100% vs 100%)
    res_comp = compute_impact(baseline=100.0, optimized=100.0, is_higher_better=True)
    assert res_comp["arrow"] == "↑"
    assert res_comp["is_improved"] is True
    assert res_comp["pct"] == 0.0

    # Regression case: availability drops
    res_drop = compute_impact(baseline=95.0, optimized=80.0, is_higher_better=True)
    assert res_drop["arrow"] == "↓"
    assert res_drop["is_improved"] is False
    assert res_drop["pct"] == 15.8


def test_decrease_is_better_calculation():
    """Test lower-is-better metrics (Train Disruption, Corridor Block Time, Separate Blocks)."""
    # Train Disruption reduction
    res_disrup = compute_impact(baseline=7697.0, optimized=3726.0, is_higher_better=False)
    assert res_disrup["arrow"] == "↓"
    assert res_disrup["is_improved"] is True
    assert res_disrup["pct"] == 51.6
    assert res_disrup["display"] == "↓ 51.6%"

    # Corridor Block Time reduction
    res_hrs = compute_impact(baseline=64.0, optimized=59.0, is_higher_better=False)
    assert res_hrs["arrow"] == "↓"
    assert res_hrs["is_improved"] is True
    assert res_hrs["pct"] == 7.8
    assert res_hrs["display"] == "↓ 7.8%"

    # Separate Blocks reduction
    res_blocks = compute_impact(baseline=22, optimized=19, is_higher_better=False)
    assert res_blocks["arrow"] == "↓"
    assert res_blocks["is_improved"] is True
    assert res_blocks["pct"] == 13.6
    assert res_blocks["display"] == "↓ 13.6%"

    # Regression case: disruption increases
    res_worse = compute_impact(baseline=1000.0, optimized=1500.0, is_higher_better=False)
    assert res_worse["arrow"] == "↑"
    assert res_worse["is_improved"] is False
    assert res_worse["pct"] == 50.0
    assert res_worse["display"] == "↑ +50.0%"


def test_safe_zero_baseline_handling():
    """Test edge cases with 0 baseline values to verify divide-by-zero protection."""
    # Higher is better: 0 to 5 integrated blocks
    res_zero_high = compute_impact(baseline=0, optimized=5, is_higher_better=True)
    assert res_zero_high["arrow"] == "↑"
    assert res_zero_high["is_improved"] is True
    assert res_zero_high["pct"] == 100.0

    # Higher is better: both 0
    res_both_zero_high = compute_impact(baseline=0, optimized=0, is_higher_better=True)
    assert res_both_zero_high["arrow"] == "↑"
    assert res_both_zero_high["pct"] == 0.0

    # Lower is better: both 0 disruption
    res_both_zero_low = compute_impact(baseline=0, optimized=0, is_higher_better=False)
    assert res_both_zero_low["arrow"] == "↓"
    assert res_both_zero_low["pct"] == 0.0
