"""
Constraint Validation Engine

Validates whether a candidate maintenance block assignment is feasible
by checking 10 constraint types.
"""

from datetime import date, time, datetime, timedelta
from sqlalchemy.orm import Session

from app.models import (
    MaintenanceTask, BlockWindow, TrainSchedule, BlockPlan, BlockTask,
    PlanningConstraint, TrackSection, BlockStatus, PlanStatus,
)
from app.schemas import ValidationResult


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _times_overlap(s1: time, e1: time, s2: time, e2: time) -> bool:
    s1m, e1m = _time_to_minutes(s1), _time_to_minutes(e1)
    s2m, e2m = _time_to_minutes(s2), _time_to_minutes(e2)
    if e1m <= s1m:
        e1m += 24 * 60
    if e2m <= s2m:
        e2m += 24 * 60
    return s1m < e2m and s2m < e1m


class ConstraintValidationService:
    """Validates maintenance block assignments against all constraints."""

    def __init__(self, db: Session):
        self.db = db
        self._load_constraints()

    def _load_constraints(self):
        """Load active constraints from database."""
        constraints = self.db.query(PlanningConstraint).filter(
            PlanningConstraint.enabled == True
        ).all()
        self.constraints = {c.constraint_type: c for c in constraints}

    def validate(
        self,
        task: MaintenanceTask,
        window: BlockWindow,
        existing_assignments: list[tuple[int, int]] | None = None,
    ) -> ValidationResult:
        """
        Validate a task-window assignment against all constraints.

        Args:
            task: The maintenance task
            window: The block window to assign to
            existing_assignments: List of (task_id, window_id) already assigned

        Returns:
            ValidationResult with feasibility, violations, warnings, score
        """
        violations = []
        warnings = []
        score = 100.0

        # 1. Train conflict
        v, w, s = self._check_train_conflict(task, window)
        violations.extend(v)
        warnings.extend(w)
        score -= s

        # 2. Block duration
        v, w, s = self._check_block_duration(task, window)
        violations.extend(v)
        warnings.extend(w)
        score -= s

        # 3. Section availability
        v, w, s = self._check_section_availability(window)
        violations.extend(v)
        warnings.extend(w)
        score -= s

        # 4. Track occupancy
        v, w, s = self._check_track_occupancy(window, existing_assignments)
        violations.extend(v)
        warnings.extend(w)
        score -= s

        # 5. Asset availability
        v, w, s = self._check_asset_availability(task)
        violations.extend(v)
        warnings.extend(w)
        score -= s

        # 6. Resource availability
        v, w, s = self._check_resource_availability(task, window, existing_assignments)
        violations.extend(v)
        warnings.extend(w)
        score -= s

        # 7. Maintenance dependency
        v, w, s = self._check_maintenance_dependency(task)
        violations.extend(v)
        warnings.extend(w)
        score -= s

        # 8. Department constraints
        v, w, s = self._check_department_constraints(task, window, existing_assignments)
        violations.extend(v)
        warnings.extend(w)
        score -= s

        # 9. Operational rules (min gap)
        v, w, s = self._check_operational_rules(window, existing_assignments)
        violations.extend(v)
        warnings.extend(w)
        score -= s

        # 10. Existing block conflicts
        v, w, s = self._check_existing_block_conflicts(window)
        violations.extend(v)
        warnings.extend(w)
        score -= s

        feasible = len(violations) == 0
        score = max(0.0, min(100.0, score))

        return ValidationResult(
            feasible=feasible,
            violations=violations,
            warnings=warnings,
            score=round(score, 1),
        )

    def _check_train_conflict(self, task, window) -> tuple[list, list, float]:
        violations, warnings = [], []
        penalty = 0.0

        constraint = self.constraints.get("train_conflict")
        if not constraint:
            return violations, warnings, penalty

        buffer = constraint.value.get("buffer_minutes", 10) if constraint.value else 10

        schedules = self.db.query(TrainSchedule).filter(
            TrainSchedule.section_id == window.section_id,
            TrainSchedule.date == window.date,
        ).all()

        conflicts = []
        for ts in schedules:
            # Expand window times by buffer
            ws = _time_to_minutes(window.start_time) - buffer
            we = _time_to_minutes(window.end_time) + buffer
            ta = _time_to_minutes(ts.arrival_time)
            td = _time_to_minutes(ts.departure_time)

            if ws < td and ta < we:
                train_info = f"{ts.train.train_number} {ts.train.train_name}" if ts.train else str(ts.train_id)
                priority = ts.train.priority.value if ts.train else "Medium"
                conflicts.append((train_info, priority))

        # Critical/High priority train conflicts are violations
        critical_conflicts = [c for c in conflicts if c[1] in ["Critical", "High"]]
        other_conflicts = [c for c in conflicts if c[1] not in ["Critical", "High"]]

        if critical_conflicts:
            violations.append(
                f"Conflicts with {len(critical_conflicts)} high-priority trains: "
                + ", ".join(c[0] for c in critical_conflicts[:3])
            )
            penalty += 30

        if other_conflicts:
            warnings.append(
                f"{len(other_conflicts)} lower-priority train conflicts detected"
            )
            penalty += len(other_conflicts) * 5

        return violations, warnings, penalty

    def _check_block_duration(self, task, window) -> tuple[list, list, float]:
        violations, warnings = [], []
        penalty = 0.0

        window_dur = window.duration_minutes
        task_dur = task.duration_minutes

        if window_dur < task_dur:
            violations.append(
                f"Window duration ({window_dur}min) < task duration ({task_dur}min)"
            )
            penalty += 50
        elif window_dur < task_dur + 15:
            warnings.append(
                f"Tight fit: only {window_dur - task_dur}min buffer in window"
            )
            penalty += 5

        return violations, warnings, penalty

    def _check_section_availability(self, window) -> tuple[list, list, float]:
        violations, warnings = [], []
        penalty = 0.0

        section = self.db.query(TrackSection).filter(
            TrackSection.id == window.section_id
        ).first()
        if section and not section.available:
            violations.append(f"Section {section.section_code} is currently unavailable")
            penalty += 50

        return violations, warnings, penalty

    def _check_track_occupancy(self, window, existing_assignments) -> tuple[list, list, float]:
        violations, warnings = [], []
        penalty = 0.0

        if not existing_assignments:
            return violations, warnings, penalty

        # Check if another task is already assigned to an overlapping window on same section
        for task_id, win_id in existing_assignments:
            other_window = self.db.query(BlockWindow).filter(BlockWindow.id == win_id).first()
            if not other_window:
                continue
            if other_window.section_id != window.section_id:
                continue
            if other_window.date != window.date:
                continue
            if other_window.id == window.id:
                continue  # Same window (could be parallel)
            if _times_overlap(window.start_time, window.end_time,
                              other_window.start_time, other_window.end_time):
                warnings.append("Another block overlaps on this section and time")
                penalty += 10

        return violations, warnings, penalty

    def _check_asset_availability(self, task) -> tuple[list, list, float]:
        violations, warnings = [], []
        penalty = 0.0

        if task.asset and task.asset.status and task.asset.status.value == "Decommissioned":
            violations.append(f"Asset {task.asset.asset_code} is decommissioned")
            penalty += 50

        return violations, warnings, penalty

    def _check_resource_availability(self, task, window, existing_assignments) -> tuple[list, list, float]:
        violations, warnings = [], []
        penalty = 0.0

        constraint = self.constraints.get("resource_availability")
        if not constraint or not constraint.value:
            return violations, warnings, penalty

        max_crew = constraint.value.get("max_crew_per_day", 30)
        required_crew = task.required_resources.get("crew", 0) if task.required_resources else 0

        # Simple check: if single task needs more than max
        if required_crew > max_crew:
            violations.append(f"Task requires {required_crew} crew but max is {max_crew}")
            penalty += 30

        return violations, warnings, penalty

    def _check_maintenance_dependency(self, task) -> tuple[list, list, float]:
        # Dependencies are stored in constraint config; for prototype, no violations
        return [], [], 0.0

    def _check_department_constraints(self, task, window, existing_assignments) -> tuple[list, list, float]:
        violations, warnings = [], []
        penalty = 0.0

        constraint = self.constraints.get("department_constraint")
        if not constraint or not constraint.value:
            return violations, warnings, penalty

        max_blocks = constraint.value.get("max_blocks_per_dept_per_day", 4)

        # Count existing blocks for this department on this date
        if existing_assignments:
            dept_count = 0
            for t_id, w_id in existing_assignments:
                other_task = self.db.query(MaintenanceTask).filter(MaintenanceTask.id == t_id).first()
                other_window = self.db.query(BlockWindow).filter(BlockWindow.id == w_id).first()
                if (other_task and other_window and
                    other_task.department_id == task.department_id and
                    other_window.date == window.date):
                    dept_count += 1
            if dept_count >= max_blocks:
                warnings.append(
                    f"Department has {dept_count} blocks on this date (max: {max_blocks})"
                )
                penalty += 10

        return violations, warnings, penalty

    def _check_operational_rules(self, window, existing_assignments) -> tuple[list, list, float]:
        violations, warnings = [], []
        penalty = 0.0

        constraint = self.constraints.get("operational_rules")
        if not constraint or not constraint.value:
            return violations, warnings, penalty

        min_gap = constraint.value.get("min_gap_minutes", 60)

        if existing_assignments:
            for _, w_id in existing_assignments:
                other = self.db.query(BlockWindow).filter(BlockWindow.id == w_id).first()
                if not other or other.section_id != window.section_id or other.date != window.date:
                    continue

                gap = abs(_time_to_minutes(window.start_time) - _time_to_minutes(other.end_time))
                gap2 = abs(_time_to_minutes(other.start_time) - _time_to_minutes(window.end_time))
                actual_gap = min(gap, gap2)

                if actual_gap < min_gap and not _times_overlap(
                    window.start_time, window.end_time, other.start_time, other.end_time
                ):
                    warnings.append(
                        f"Gap between consecutive blocks is only {actual_gap}min (min: {min_gap}min)"
                    )
                    penalty += 5

        return violations, warnings, penalty

    def _check_existing_block_conflicts(self, window) -> tuple[list, list, float]:
        violations, warnings = [], []
        penalty = 0.0

        existing = self.db.query(BlockPlan).join(BlockWindow).filter(
            BlockWindow.section_id == window.section_id,
            BlockPlan.plan_date == window.date,
            BlockPlan.status.in_([PlanStatus.OPTIMIZED, PlanStatus.APPROVED]),
        ).all()

        for plan in existing:
            bw = plan.block_window
            if _times_overlap(window.start_time, window.end_time, bw.start_time, bw.end_time):
                violations.append(
                    f"Conflicts with existing {plan.status.value} block plan #{plan.id}"
                )
                penalty += 40

        return violations, warnings, penalty
