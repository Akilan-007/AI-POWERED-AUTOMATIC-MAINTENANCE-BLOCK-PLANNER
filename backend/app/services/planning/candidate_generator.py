"""
Candidate Block Generator

For each maintenance task, generates feasible candidate time windows
by checking available block windows and train schedules.
"""

from datetime import date, time, datetime, timedelta
from sqlalchemy.orm import Session

from app.models import (
    MaintenanceTask, BlockWindow, TrainSchedule, TrackSection,
    TaskStatus, BlockStatus, TrainPriority,
)
from app.schemas import CandidateWindow, ValidationResult


def _time_to_minutes(t: time) -> int:
    """Convert time to minutes since midnight."""
    return t.hour * 60 + t.minute


def _minutes_to_time(m: int) -> time:
    """Convert minutes since midnight to time."""
    m = m % (24 * 60)
    return time(m // 60, m % 60)


def _window_duration_minutes(start: time, end: time) -> int:
    """Calculate duration between two times in minutes."""
    s = _time_to_minutes(start)
    e = _time_to_minutes(end)
    if e <= s:
        e += 24 * 60  # Overnight window
    return e - s


def _times_overlap(s1: time, e1: time, s2: time, e2: time, buffer: int = 10) -> bool:
    """Check if two time ranges overlap (with buffer)."""
    s1m = _time_to_minutes(s1) - buffer
    e1m = _time_to_minutes(e1) + buffer
    s2m = _time_to_minutes(s2)
    e2m = _time_to_minutes(e2)

    # Handle overnight
    if e1m <= s1m:
        e1m += 24 * 60
    if e2m <= s2m:
        e2m += 24 * 60

    return s1m < e2m and s2m < e1m


def generate_candidates_for_task(
    task: MaintenanceTask,
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[CandidateWindow]:
    """
    Generate feasible candidate block windows for a maintenance task.

    Steps:
    1. Find available block windows on the task's section
    2. Check each window has enough duration
    3. Check for train schedule conflicts
    4. Return list of feasible (and infeasible with reasons) candidates
    """
    if not start_date:
        today = date.today()
        start_date = today - timedelta(days=today.weekday())
    if not end_date:
        end_date = start_date + timedelta(days=6)

    section_id = task.section_id
    duration_needed = task.duration_minutes

    # Get available block windows for this section in the date range
    windows = (
        db.query(BlockWindow)
        .filter(
            BlockWindow.section_id == section_id,
            BlockWindow.date >= start_date,
            BlockWindow.date <= end_date,
            BlockWindow.status == BlockStatus.AVAILABLE,
        )
        .order_by(BlockWindow.date, BlockWindow.start_time)
        .all()
    )

    # Get train schedules for this section
    train_schedules = (
        db.query(TrainSchedule)
        .filter(
            TrainSchedule.section_id == section_id,
            TrainSchedule.date >= start_date,
            TrainSchedule.date <= end_date,
        )
        .all()
    )

    # Build schedule lookup by date
    schedule_by_date: dict[date, list[TrainSchedule]] = {}
    for ts in train_schedules:
        schedule_by_date.setdefault(ts.date, []).append(ts)

    candidates = []
    section = db.query(TrackSection).filter(TrackSection.id == section_id).first()
    section_code = section.section_code if section else "UNKNOWN"

    for window in windows:
        window_duration = _window_duration_minutes(window.start_time, window.end_time)
        violations = []
        warnings = []

        # Check 1: Duration fits
        if window_duration < duration_needed:
            violations.append(
                f"Maintenance duration is {duration_needed} minutes but window only has {window_duration} minutes available."
            )

        # Check 2: Train conflicts
        day_schedules = schedule_by_date.get(window.date, [])
        critical_conflicts = []
        regular_conflicts = []
        for ts in day_schedules:
            if _times_overlap(window.start_time, window.end_time, ts.arrival_time, ts.departure_time):
                train_name = ts.train.train_name if ts.train else str(ts.train_id)
                train_number = ts.train.train_number if ts.train else ""
                priority = ts.train.priority if ts.train else TrainPriority.MEDIUM
                info = f"{train_number} {train_name}".strip()
                if priority in (TrainPriority.CRITICAL, TrainPriority.HIGH):
                    critical_conflicts.append(info)
                else:
                    regular_conflicts.append(info)

        if critical_conflicts:
            violations.append(
                f"High-priority train conflict: {len(critical_conflicts)} critical train(s) scheduled ({', '.join(critical_conflicts[:3])})"
            )
        if regular_conflicts:
            warnings.append(
                f"Train conflict with: {', '.join(regular_conflicts[:3])}. Disruption will be penalized."
            )

        feasible = len(violations) == 0
        score = 0.0
        if feasible:
            # Score: prefer windows with fewer conflicts, earlier dates
            conflict_penalty = len(regular_conflicts) * 8
            days_away = (window.date - date.today()).days
            freshness_bonus = max(0, 20 - days_away * 2)
            duration_bonus = min(20, (window_duration - duration_needed) / 10)
            score = max(0, 100 - conflict_penalty + freshness_bonus + duration_bonus)

        candidates.append(CandidateWindow(
            block_window_id=window.id,
            section_id=section_id,
            section_code=section_code,
            date=window.date,
            start_time=window.start_time,
            end_time=window.end_time,
            duration_minutes=window_duration,
            validation=ValidationResult(
                feasible=feasible,
                violations=violations,
                warnings=warnings,
                score=round(score, 1),
            ),
        ))

    return candidates


def generate_all_candidates(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    include_scheduled: bool = True,
) -> list[dict]:
    """Generate candidate windows for all pending/overdue/scheduled tasks."""
    statuses = [TaskStatus.PENDING, TaskStatus.OVERDUE]
    if include_scheduled:
        statuses.append(TaskStatus.SCHEDULED)
    tasks = db.query(MaintenanceTask).filter(
        MaintenanceTask.status.in_(statuses)
    ).all()

    all_candidates = []
    for task in tasks:
        candidates = generate_candidates_for_task(task, db, start_date, end_date)
        all_candidates.append({
            "task_id": task.id,
            "task_code": task.task_code,
            "candidates": candidates,
        })

    return all_candidates
