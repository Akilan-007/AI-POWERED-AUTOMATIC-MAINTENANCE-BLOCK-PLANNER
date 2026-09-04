"""
AI Priority Engine

Calculates maintenance task priority scores (0-100) using a transparent
weighted scoring model. Provides explainable reasoning for each score.

ML determines maintenance priority; OR-Tools determines the optimal schedule.
"""

from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.models import (
    MaintenanceTask, Asset, MaintenanceHistory,
    TaskStatus, UrgencyLevel, CriticalityLevel, AssetStatus,
)


# Configurable weights (sum to 1.0)
WEIGHTS = {
    "criticality": 0.25,
    "urgency": 0.20,
    "condition": 0.20,
    "overdue": 0.20,
    "availability_impact": 0.15,
}

CRITICALITY_SCORES = {
    "Critical": 100,
    "High": 75,
    "Medium": 50,
    "Low": 25,
}

URGENCY_SCORES = {
    UrgencyLevel.IMMEDIATE: 100,
    UrgencyLevel.URGENT: 80,
    UrgencyLevel.NORMAL: 50,
    UrgencyLevel.PLANNED: 25,
}


def calculate_priority(task: MaintenanceTask, db: Session) -> dict:
    """
    Calculate a priority score (0-100) for a maintenance task.

    Returns a dict with:
      - score: int (0-100)
      - classification: str (Critical/High/Medium/Low)
      - explanation: str (human-readable reasoning)
      - factors: dict (individual factor scores)
    """
    asset = task.asset
    today = date.today()

    # ─── Factor 1: Criticality (from task + asset) ───
    task_crit = CRITICALITY_SCORES.get(task.criticality, 50)
    asset_crit = CRITICALITY_SCORES.get(asset.criticality.value if asset else "Medium", 50)
    criticality_score = max(task_crit, asset_crit)

    # ─── Factor 2: Urgency ───
    urgency_score = URGENCY_SCORES.get(task.urgency, 50)

    # ─── Factor 3: Asset Condition (inverse - worse condition = higher priority) ───
    condition = asset.condition_score if asset else 80.0
    condition_score = max(0, min(100, 100 - condition))

    # ─── Factor 4: Overdue Status ───
    days_until_due = (task.due_date - today).days if task.due_date else 30
    if days_until_due < -7:
        overdue_score = 100
    elif days_until_due < -3:
        overdue_score = 90
    elif days_until_due < 0:
        overdue_score = 80
    elif days_until_due < 3:
        overdue_score = 60
    elif days_until_due < 7:
        overdue_score = 40
    elif days_until_due < 14:
        overdue_score = 20
    else:
        overdue_score = 10

    # ─── Factor 5: Availability Impact ───
    availability = asset.availability if asset else 100.0
    if availability < 60:
        availability_score = 100
    elif availability < 70:
        availability_score = 80
    elif availability < 80:
        availability_score = 60
    elif availability < 90:
        availability_score = 40
    else:
        availability_score = 20

    # ─── Bonus: Emergency/Corrective type modifier ───
    type_bonus = 0
    if task.maintenance_type and task.maintenance_type.value in ["Emergency", "Corrective"]:
        type_bonus = 10

    # ─── Bonus: Asset status modifier ───
    status_bonus = 0
    if asset and asset.status == AssetStatus.FAILED:
        status_bonus = 15
    elif asset and asset.status == AssetStatus.DEGRADED:
        status_bonus = 8

    # ─── Weighted Score ───
    weighted = (
        WEIGHTS["criticality"] * criticality_score
        + WEIGHTS["urgency"] * urgency_score
        + WEIGHTS["condition"] * condition_score
        + WEIGHTS["overdue"] * overdue_score
        + WEIGHTS["availability_impact"] * availability_score
    )

    final_score = min(100, int(weighted + type_bonus + status_bonus))

    # ─── Classification ───
    if final_score >= 80:
        classification = "Critical"
    elif final_score >= 60:
        classification = "High"
    elif final_score >= 40:
        classification = "Medium"
    else:
        classification = "Low"

    # ─── Explanation ───
    reasons = []
    if criticality_score >= 75:
        reasons.append(f"asset criticality is {task.criticality}")
    if condition_score >= 50:
        reasons.append(f"condition score is poor ({condition:.0f}/100)")
    if days_until_due < 0:
        reasons.append(f"maintenance is overdue by {abs(days_until_due)} days")
    elif days_until_due < 3:
        reasons.append(f"maintenance is due in {days_until_due} days")
    if urgency_score >= 80:
        reasons.append(f"urgency is {task.urgency.value}")
    if availability_score >= 60:
        reasons.append(f"asset availability is low ({availability:.0f}%)")
    if asset and asset.status in [AssetStatus.FAILED, AssetStatus.DEGRADED]:
        reasons.append(f"asset status is {asset.status.value}")

    if reasons:
        explanation = f"Task {task.task_code} received priority {final_score} because " + ", ".join(reasons) + "."
    else:
        explanation = f"Task {task.task_code} received priority {final_score} based on standard assessment."

    factors = {
        "criticality": {"score": criticality_score, "weight": WEIGHTS["criticality"]},
        "urgency": {"score": urgency_score, "weight": WEIGHTS["urgency"]},
        "condition": {"score": condition_score, "weight": WEIGHTS["condition"]},
        "overdue": {"score": overdue_score, "weight": WEIGHTS["overdue"], "days_until_due": days_until_due},
        "availability_impact": {"score": availability_score, "weight": WEIGHTS["availability_impact"]},
        "type_bonus": type_bonus,
        "status_bonus": status_bonus,
    }

    return {
        "score": final_score,
        "classification": classification,
        "explanation": explanation,
        "factors": factors,
    }


def compute_all_priorities(db: Session) -> list[dict]:
    """Compute priorities for all pending/overdue maintenance tasks."""
    tasks = db.query(MaintenanceTask).filter(
        MaintenanceTask.status.in_([TaskStatus.PENDING, TaskStatus.OVERDUE])
    ).all()

    results = []
    for task in tasks:
        result = calculate_priority(task, db)

        # Update the task in DB
        task.priority = result["score"]
        task.priority_explanation = result["explanation"]
        task.criticality = result["classification"]

        results.append({
            "task_id": task.id,
            "task_code": task.task_code,
            "priority_score": result["score"],
            "classification": result["classification"],
            "explanation": result["explanation"],
            "factors": result["factors"],
        })

    db.commit()
    return results
