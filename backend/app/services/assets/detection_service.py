"""
Active Maintenance Detection Service

Analyzes railway assets using condition scores, criticality, due dates,
availability, defect severity, and maintenance history to determine
whether maintenance is currently required.

Deterministic, explainable, and configurable thresholds.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models import (
    Asset, MaintenanceTask, MaintenanceHistory,
    AssetStatus, CriticalityLevel, TaskStatus, UrgencyLevel, MaintenanceType,
)


@dataclass
class DetectionThresholds:
    """Configurable thresholds for maintenance detection."""
    critical_condition_threshold: float = 40.0
    due_condition_threshold: float = 60.0
    monitor_condition_threshold: float = 75.0
    critical_availability_threshold: float = 65.0
    monitor_availability_threshold: float = 80.0
    due_days_window: int = 7  # Due within N days
    monitor_days_window: int = 14
    critical_overdue_days: int = 3  # Overdue by > N days with high criticality is critical


# Default configurable thresholds
DEFAULT_THRESHOLDS = DetectionThresholds()


class ActiveMaintenanceDetectionService:
    """Evaluates asset health and detects active maintenance requirements."""

    def __init__(self, db: Session, thresholds: Optional[DetectionThresholds] = None):
        self.db = db
        self.thresholds = thresholds or DEFAULT_THRESHOLDS

    def evaluate_asset(self, asset: Asset) -> Dict[str, Any]:
        """
        Evaluate a single asset for maintenance requirements.

        Returns:
            Dict with asset_id, asset_code, name, maintenance_required,
            maintenance_status, detection_score, reasons, factors.
        """
        today = date.today()
        t = self.thresholds

        # Extract factors
        condition = asset.condition_score
        availability = asset.availability
        crit_str = asset.criticality.value if hasattr(asset.criticality, "value") else str(asset.criticality)
        status_str = asset.status.value if hasattr(asset.status, "value") else str(asset.status)
        
        days_until_due = (asset.next_due_date - today).days if asset.next_due_date else 999
        is_overdue = days_until_due < 0
        overdue_days = abs(days_until_due) if is_overdue else 0

        reasons: List[str] = []
        factors: Dict[str, Any] = {
            "condition_score": condition,
            "availability": availability,
            "criticality": crit_str,
            "asset_status": status_str,
            "days_until_due": days_until_due,
            "is_overdue": is_overdue,
            "overdue_days": overdue_days,
        }

        # ─── 1. Determine Status & Reasons ───
        # Critical checks
        is_critical = False
        if condition < t.critical_condition_threshold:
            is_critical = True
            reasons.append(f"Asset condition ({condition:.0f}/100) is below critical safety threshold ({t.critical_condition_threshold:.0f})")
        
        if status_str == "Failed":
            is_critical = True
            reasons.append("Asset status is FAILED requiring emergency intervention")
        
        if is_overdue and crit_str in ["Critical", "High"] and overdue_days >= t.critical_overdue_days:
            is_critical = True
            reasons.append(f"Maintenance is overdue by {overdue_days} days for {crit_str} criticality asset")

        if availability < t.critical_availability_threshold:
            is_critical = True
            reasons.append(f"Asset availability ({availability:.1f}%) has dropped below critical limit ({t.critical_availability_threshold:.0f}%)")

        if is_critical:
            maintenance_status = "CRITICAL"
            maintenance_required = True

        # Overdue check
        elif is_overdue:
            maintenance_status = "OVERDUE"
            maintenance_required = True
            reasons.append(f"Maintenance is overdue by {overdue_days} days (Due date: {asset.next_due_date})")
            if crit_str in ["Critical", "High"]:
                reasons.append(f"Asset criticality is {crit_str}")
            if condition < t.due_condition_threshold:
                reasons.append(f"Condition score is degraded ({condition:.0f}/100)")

        # Maintenance Due check
        elif (condition < t.due_condition_threshold and days_until_due <= t.due_days_window) or days_until_due <= 3 or (availability < t.monitor_availability_threshold and condition < 70):
            maintenance_status = "MAINTENANCE_DUE"
            maintenance_required = True
            if days_until_due <= t.due_days_window:
                reasons.append(f"Scheduled maintenance is due in {days_until_due} days")
            if condition < t.due_condition_threshold:
                reasons.append(f"Asset condition score ({condition:.0f}/100) is below maintenance threshold ({t.due_condition_threshold:.0f})")
            if availability < t.monitor_availability_threshold:
                reasons.append(f"Asset availability ({availability:.1f}%) is below operational baseline ({t.monitor_availability_threshold:.0f}%)")

        # Monitor check
        elif condition < t.monitor_condition_threshold or availability < t.monitor_availability_threshold or days_until_due <= t.monitor_days_window or status_str == "Degraded":
            maintenance_status = "MONITOR"
            maintenance_required = False
            if condition < t.monitor_condition_threshold:
                reasons.append(f"Condition score ({condition:.0f}/100) requires proactive monitoring")
            if availability < t.monitor_availability_threshold:
                reasons.append(f"Availability ({availability:.1f}%) is sub-optimal")
            if days_until_due <= t.monitor_days_window:
                reasons.append(f"Maintenance due approaching in {days_until_due} days")
            if status_str == "Degraded":
                reasons.append("Asset status is currently marked as Degraded")

        # Healthy
        else:
            maintenance_status = "HEALTHY"
            maintenance_required = False
            reasons.append("Asset parameters are within normal safe operational tolerances")

        # ─── 2. Calculate Detection / Severity Score (0-100) ───
        # Condition risk (worse condition = higher score)
        cond_risk = max(0.0, min(100.0, 100.0 - condition))
        # Availability risk
        avail_risk = max(0.0, min(100.0, 100.0 - availability))
        # Overdue risk
        if is_overdue:
            overdue_risk = min(100.0, 60.0 + overdue_days * 8.0)
        elif days_until_due <= 3:
            overdue_risk = 50.0
        elif days_until_due <= 7:
            overdue_risk = 35.0
        elif days_until_due <= 14:
            overdue_risk = 20.0
        else:
            overdue_risk = 5.0
        
        # Criticality factor
        crit_factor = {"Critical": 100.0, "High": 80.0, "Medium": 50.0, "Low": 25.0}.get(crit_str, 50.0)

        # Weighted calculation
        raw_score = (
            0.30 * cond_risk +
            0.25 * overdue_risk +
            0.20 * crit_factor +
            0.15 * avail_risk +
            (10.0 if status_str in ["Failed", "Degraded"] else 0.0)
        )

        if maintenance_status == "CRITICAL":
            detection_score = max(80, min(100, int(raw_score + 15)))
        elif maintenance_status == "OVERDUE":
            detection_score = max(65, min(90, int(raw_score + 5)))
        elif maintenance_status == "MAINTENANCE_DUE":
            detection_score = max(50, min(75, int(raw_score)))
        elif maintenance_status == "MONITOR":
            detection_score = max(25, min(50, int(raw_score * 0.7)))
        else:
            detection_score = max(5, min(25, int(raw_score * 0.3)))

        factors["component_scores"] = {
            "condition_risk": round(cond_risk, 1),
            "overdue_risk": round(overdue_risk, 1),
            "criticality_factor": round(crit_factor, 1),
            "availability_risk": round(avail_risk, 1),
        }

        # Check for existing maintenance task
        existing_task = (
            self.db.query(MaintenanceTask)
            .filter(
                MaintenanceTask.asset_id == asset.id,
                MaintenanceTask.status.in_([TaskStatus.PENDING, TaskStatus.SCHEDULED, TaskStatus.OVERDUE]),
            )
            .first()
        )

        return {
            "asset_id": asset.id,
            "asset_code": asset.asset_code,
            "name": asset.name,
            "asset_type": asset.asset_type.value if hasattr(asset.asset_type, "value") else str(asset.asset_type),
            "department_code": asset.department.code if asset.department else "ENG",
            "department_name": asset.department.name if asset.department else "Engineering",
            "section_code": asset.section.section_code if asset.section else "UNKNOWN",
            "condition_score": asset.condition_score,
            "availability": asset.availability,
            "criticality": crit_str,
            "status": status_str,
            "next_due_date": str(asset.next_due_date) if asset.next_due_date else None,
            "maintenance_required": maintenance_required,
            "maintenance_status": maintenance_status,
            "detection_score": detection_score,
            "reasons": reasons,
            "factors": factors,
            "existing_task_id": existing_task.id if existing_task else None,
            "existing_task_code": existing_task.task_code if existing_task else None,
            "existing_task_status": existing_task.status.value if existing_task else None,
        }

    def detect_all(self, active_only: bool = False) -> List[Dict[str, Any]]:
        """Evaluate all assets in the database."""
        assets = self.db.query(Asset).order_by(Asset.asset_code).all()
        results = [self.evaluate_asset(a) for a in assets]
        if active_only:
            results = [r for r in results if r["maintenance_required"]]
        # Sort by detection_score descending
        results.sort(key=lambda r: r["detection_score"], reverse=True)
        return results

    def get_summary(self) -> Dict[str, int]:
        """Get count summary of detection statuses."""
        all_results = self.detect_all(active_only=False)
        return {
            "total_assets": len(all_results),
            "critical_assets": sum(1 for r in all_results if r["maintenance_status"] == "CRITICAL"),
            "overdue_assets": sum(1 for r in all_results if r["maintenance_status"] == "OVERDUE"),
            "maintenance_due": sum(1 for r in all_results if r["maintenance_status"] == "MAINTENANCE_DUE"),
            "monitor_assets": sum(1 for r in all_results if r["maintenance_status"] == "MONITOR"),
            "healthy_assets": sum(1 for r in all_results if r["maintenance_status"] == "HEALTHY"),
            "requiring_maintenance": sum(1 for r in all_results if r["maintenance_required"]),
        }

    def scan_and_sync(self) -> Dict[str, Any]:
        """
        Execute an active health scan of all assets:
        1. Evaluates maintenance conditions
        2. Detects maintenance requirements
        3. Creates/links maintenance tasks without duplicates
        4. Triggers AI priority computation for newly created/updated tasks
        """
        evaluations = self.detect_all(active_only=False)
        created_tasks_count = 0
        updated_tasks_count = 0
        today = date.today()

        for eval_res in evaluations:
            if not eval_res["maintenance_required"]:
                continue

            asset = self.db.query(Asset).filter(Asset.id == eval_res["asset_id"]).first()
            if not asset:
                continue

            # Check if active task already exists to prevent duplicate creation
            existing_task = (
                self.db.query(MaintenanceTask)
                .filter(
                    MaintenanceTask.asset_id == asset.id,
                    MaintenanceTask.status.in_([TaskStatus.PENDING, TaskStatus.SCHEDULED, TaskStatus.OVERDUE]),
                )
                .first()
            )

            # Map status to urgency
            if eval_res["maintenance_status"] == "CRITICAL":
                urgency = UrgencyLevel.IMMEDIATE
                m_type = MaintenanceType.CORRECTIVE if asset.status == AssetStatus.FAILED else MaintenanceType.PREVENTIVE
                due = today
                task_status = TaskStatus.OVERDUE if eval_res["factors"]["is_overdue"] else TaskStatus.PENDING
            elif eval_res["maintenance_status"] == "OVERDUE":
                urgency = UrgencyLevel.URGENT
                m_type = MaintenanceType.CORRECTIVE
                due = asset.next_due_date or today
                task_status = TaskStatus.OVERDUE
            else:  # MAINTENANCE_DUE
                urgency = UrgencyLevel.NORMAL
                m_type = MaintenanceType.PREVENTIVE
                due = asset.next_due_date or (today + timedelta(days=5))
                task_status = TaskStatus.PENDING

            if existing_task:
                # Update task urgency / priority explanation if elevated
                if eval_res["detection_score"] > existing_task.priority:
                    existing_task.priority = eval_res["detection_score"]
                existing_task.urgency = urgency
                if not existing_task.priority_explanation or "detected" not in existing_task.priority_explanation.lower():
                    existing_task.priority_explanation = (
                        f"Active Scan: {'; '.join(eval_res['reasons'][:2])}"
                    )
                eval_res["existing_task_id"] = existing_task.id
                eval_res["existing_task_code"] = existing_task.task_code
                updated_tasks_count += 1
            else:
                # Create a new maintenance task for the detected asset
                task_code = f"DET-{asset.asset_code}"
                # Ensure unique task code
                existing_code = self.db.query(MaintenanceTask).filter(MaintenanceTask.task_code == task_code).first()
                if existing_code:
                    task_code = f"DET-{asset.asset_code}-{today.strftime('%d%m')}"

                new_task = MaintenanceTask(
                    task_code=task_code,
                    asset_id=asset.id,
                    department_id=asset.department_id,
                    section_id=asset.section_id,
                    maintenance_type=m_type,
                    description=f"Auto-detected {eval_res['maintenance_status']} maintenance for {asset.name} ({asset.asset_code})",
                    duration_minutes=90 if eval_res["maintenance_status"] == "CRITICAL" else 60,
                    priority=eval_res["detection_score"],
                    criticality=eval_res["criticality"],
                    urgency=urgency,
                    due_date=due,
                    status=task_status,
                    required_resources={"crew": 4},
                    priority_explanation=f"Active Scan: {'; '.join(eval_res['reasons'][:2])}",
                )
                self.db.add(new_task)
                self.db.flush()
                eval_res["existing_task_id"] = new_task.id
                eval_res["existing_task_code"] = new_task.task_code
                created_tasks_count += 1

        self.db.commit()

        summary = self.get_summary()

        return {
            "success": True,
            "scan_timestamp": str(today),
            "summary": summary,
            "created_tasks_count": created_tasks_count,
            "updated_tasks_count": updated_tasks_count,
            "active_detections": [e for e in evaluations if e["maintenance_required"]],
        }
