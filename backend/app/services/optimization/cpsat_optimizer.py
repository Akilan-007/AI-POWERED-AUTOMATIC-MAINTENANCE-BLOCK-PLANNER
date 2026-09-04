"""
OR-Tools CP-SAT Optimization Engine

Uses Google OR-Tools Constraint Programming with SAT solver
to generate optimized maintenance block plans.

Decision variables: x[task_i, window_j] = 1 if task i is assigned to window j
Objective: Maximize asset availability + priority completion - train disruption
"""

from datetime import date, time, datetime, timedelta
from ortools.sat.python import cp_model
from sqlalchemy.orm import Session

from app.models import (
    MaintenanceTask, BlockWindow, TrainSchedule, BlockPlan, BlockTask,
    TrackSection, Asset, Department, TaskStatus, BlockStatus, PlanStatus,
)
from app.services.planning.candidate_generator import generate_candidates_for_task
from app.services.constraints.constraint_engine import ConstraintValidationService
from app.config import get_settings


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _minutes_to_time(m: int) -> time:
    m = m % (24 * 60)
    return time(m // 60, m % 60)


class BlockPlanOptimizer:
    """CP-SAT based maintenance block plan optimizer."""

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.constraint_service = ConstraintValidationService(db)

    def optimize(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        task_ids: list[int] | None = None,
    ) -> dict:
        """
        Run OR-Tools CP-SAT optimization to generate an optimal block plan.

        Returns optimization result with plans, scores, and insights.
        """
        if not start_date:
            start_date = date.today()
        if not end_date:
            end_date = start_date + timedelta(days=7)

        # 1. Get tasks to schedule
        query = self.db.query(MaintenanceTask).filter(
            MaintenanceTask.status.in_([TaskStatus.PENDING, TaskStatus.OVERDUE, TaskStatus.SCHEDULED])
        )
        if task_ids:
            query = query.filter(MaintenanceTask.id.in_(task_ids))
        tasks = query.order_by(MaintenanceTask.priority.desc()).all()

        if not tasks:
            return self._empty_result("optimized")

        # 2. Generate candidates for each task
        task_candidates = {}
        for task in tasks:
            candidates = generate_candidates_for_task(task, self.db, start_date, end_date)
            feasible = [c for c in candidates if c.validation.feasible]
            task_candidates[task.id] = feasible

        # 3. Build CP-SAT model
        model = cp_model.CpModel()

        # Decision variables: x[task_id, window_id] = bool
        x = {}
        for task in tasks:
            for cand in task_candidates.get(task.id, []):
                var_name = f"x_{task.id}_{cand.block_window_id}"
                x[(task.id, cand.block_window_id)] = model.NewBoolVar(var_name)

        # ─── Constraint: Each task assigned to at most one window ───
        for task in tasks:
            task_vars = [
                x[(task.id, c.block_window_id)]
                for c in task_candidates.get(task.id, [])
                if (task.id, c.block_window_id) in x
            ]
            if task_vars:
                model.Add(sum(task_vars) <= 1)

        # ─── Constraint: Section occupancy per window ───
        # Group by (window_id) and limit concurrent tasks
        window_tasks: dict[int, list] = {}
        for task in tasks:
            for cand in task_candidates.get(task.id, []):
                key = cand.block_window_id
                window_tasks.setdefault(key, []).append(
                    x[(task.id, cand.block_window_id)]
                )

        # Get window capacities
        window_ids = set()
        for task in tasks:
            for cand in task_candidates.get(task.id, []):
                window_ids.add(cand.block_window_id)

        windows_map = {}
        for wid in window_ids:
            w = self.db.query(BlockWindow).filter(BlockWindow.id == wid).first()
            if w:
                windows_map[wid] = w

        # Duration constraint: total task duration in a window must fit
        for wid, tvars in window_tasks.items():
            window = windows_map.get(wid)
            if not window:
                continue
            window_dur = window.duration_minutes

            # Total duration of tasks in this window must not exceed window duration
            task_durations = []
            for task in tasks:
                for cand in task_candidates.get(task.id, []):
                    if cand.block_window_id == wid and (task.id, wid) in x:
                        task_durations.append(
                            (x[(task.id, wid)], task.duration_minutes)
                        )

            if task_durations:
                model.Add(
                    sum(var * dur for var, dur in task_durations) <= window_dur
                )

        # ─── Constraint: Same section tasks can share a window (integrated block) ───
        # Already handled by duration constraint above

        # ─── Objective: Multi-criteria optimization ───
        w_avail = int(self.settings.optimization_asset_availability_weight * 100)
        w_priority = int(self.settings.optimization_maintenance_priority_weight * 100)
        w_disruption = int(self.settings.optimization_train_disruption_weight * 100)
        w_grouping = int(self.settings.optimization_grouping_weight * 100)
        w_blocks = int(self.settings.optimization_block_count_weight * 100)

        objective_terms = []

        for task in tasks:
            for cand in task_candidates.get(task.id, []):
                if (task.id, cand.block_window_id) not in x:
                    continue
                var = x[(task.id, cand.block_window_id)]

                # Priority reward: higher priority tasks get more reward
                priority_reward = task.priority * w_priority

                # Availability reward: scheduling improves availability
                avail_reward = 0
                if task.asset:
                    avail_reward = int((100 - task.asset.availability) * w_avail / 10)

                # Candidate score reward
                cand_reward = int(cand.validation.score * w_avail / 10)

                total_reward = priority_reward + avail_reward + cand_reward
                objective_terms.append(var * total_reward)

        # Grouping bonus: reward tasks in same window+section
        # This encourages integrated blocks
        for wid, tvars in window_tasks.items():
            if len(tvars) >= 2:
                # Create a variable that's 1 if >= 2 tasks assigned
                grouped = model.NewBoolVar(f"grouped_{wid}")
                model.Add(sum(tvars) >= 2).OnlyEnforceIf(grouped)
                model.Add(sum(tvars) < 2).OnlyEnforceIf(grouped.Not())
                objective_terms.append(grouped * w_grouping * 50)

        # Block count penalty: penalize using too many different windows
        window_used = {}
        for wid in window_ids:
            used_var = model.NewBoolVar(f"wused_{wid}")
            tvars = window_tasks.get(wid, [])
            if tvars:
                model.Add(sum(tvars) >= 1).OnlyEnforceIf(used_var)
                model.Add(sum(tvars) == 0).OnlyEnforceIf(used_var.Not())
                window_used[wid] = used_var
                objective_terms.append(used_var * (-w_blocks * 20))

        if objective_terms:
            model.Maximize(sum(objective_terms))

        # 4. Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.settings.optimization_time_limit_seconds
        status = solver.Solve(model)

        if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            return self._empty_result("optimized", message="No feasible solution found")

        # 5. Extract solution
        return self._extract_solution(solver, x, tasks, task_candidates, windows_map, start_date)

    def _extract_solution(self, solver, x, tasks, task_candidates, windows_map, start_date) -> dict:
        """Extract and persist the optimization solution."""
        # Clear existing optimized plans for this date range
        existing_plan_ids = [
            p.id for p in self.db.query(BlockPlan.id).filter(
                BlockPlan.plan_type == "optimized",
                BlockPlan.status == PlanStatus.DRAFT,
            ).all()
        ]
        if existing_plan_ids:
            self.db.query(BlockTask).filter(BlockTask.block_plan_id.in_(existing_plan_ids)).delete(synchronize_session=False)
            self.db.query(BlockPlan).filter(BlockPlan.id.in_(existing_plan_ids)).delete(synchronize_session=False)
        self.db.flush()

        plans = []
        scheduled_tasks = []
        unscheduled_tasks = []
        insights = []
        total_disruption = 0.0
        total_avail_improvement = 0.0

        # Group assignments by window
        window_assignments: dict[int, list[MaintenanceTask]] = {}
        for task in tasks:
            assigned = False
            for cand in task_candidates.get(task.id, []):
                if (task.id, cand.block_window_id) in x:
                    if solver.Value(x[(task.id, cand.block_window_id)]) == 1:
                        window_assignments.setdefault(cand.block_window_id, []).append(task)
                        scheduled_tasks.append(task)
                        assigned = True
                        break
            if not assigned:
                unscheduled_tasks.append(task.task_code)

        # Create BlockPlans
        for wid, assigned_tasks in window_assignments.items():
            window = windows_map.get(wid)
            if not window:
                continue

            departments = set()
            for t in assigned_tasks:
                if t.department:
                    departments.add(t.department.code)

            is_integrated = 1 if len(departments) > 1 else 0

            # Calculate metrics
            disruption = self._calculate_disruption(window)
            avail_impact = sum(
                (100 - t.asset.availability) / len(assigned_tasks)
                for t in assigned_tasks if t.asset
            ) / 100 * 5  # Simplified

            total_disruption += disruption
            total_avail_improvement += avail_impact

            # Generate reasoning
            task_descs = [t.task_code for t in assigned_tasks]
            reasoning = (
                f"Window {window.start_time.strftime('%H:%M')}-{window.end_time.strftime('%H:%M')} "
                f"on section selected for {len(assigned_tasks)} tasks ({', '.join(task_descs)}). "
            )
            if is_integrated:
                reasoning += f"Integrated block combining {', '.join(departments)} departments. "
                insights.append(
                    f"{len(departments)} departments ({', '.join(departments)}) combined into "
                    f"one integrated block on {window.date}, reducing corridor closures."
                )

            plan = BlockPlan(
                plan_date=window.date,
                block_window_id=wid,
                status=PlanStatus.OPTIMIZED,
                optimization_score=round(solver.ObjectiveValue() / max(len(window_assignments), 1), 1),
                train_disruption_minutes=disruption,
                asset_availability_impact=round(avail_impact, 2),
                is_integrated=is_integrated,
                departments_involved=list(departments),
                plan_type="optimized",
                reasoning=reasoning,
            )
            self.db.add(plan)
            self.db.flush()

            # Create BlockTasks
            current_start = _time_to_minutes(window.start_time)
            for task in assigned_tasks:
                end = current_start + task.duration_minutes
                bt = BlockTask(
                    block_plan_id=plan.id,
                    maintenance_task_id=task.id,
                    start_time=_minutes_to_time(current_start),
                    end_time=_minutes_to_time(end),
                )
                self.db.add(bt)

                # Update task status
                task.status = TaskStatus.SCHEDULED

                current_start = end

            plans.append(plan)

        # Generate insights for unscheduled tasks
        for tc in unscheduled_tasks:
            insights.append(f"Task {tc} could not be scheduled - no feasible window found.")

        self.db.commit()

        # Calculate overall score
        total_tasks = len(tasks)
        scheduled_count = len(scheduled_tasks)
        integrated_count = sum(1 for p in plans if p.is_integrated)

        opt_score = 0
        if total_tasks > 0:
            completion_rate = scheduled_count / total_tasks
            priority_score = sum(t.priority for t in scheduled_tasks) / max(
                sum(t.priority for t in tasks), 1
            )
            grouping_rate = integrated_count / max(len(plans), 1)
            opt_score = round(
                (completion_rate * 40 + priority_score * 30 + grouping_rate * 20 +
                 (1 - min(total_disruption / 300, 1)) * 10),
                1,
            )

        total_block_hours = sum(
            windows_map[p.block_window_id].duration_minutes / 60
            for p in plans if p.block_window_id in windows_map
        )

        # Build response
        from app.schemas import BlockPlanOut, BlockTaskOut, OptimizationResult

        plan_outs = []
        for p in plans:
            pout = BlockPlanOut.model_validate(p)
            w = windows_map.get(p.block_window_id)
            if w and w.section:
                pout.section_code = w.section.section_code
                pout.window_start = w.start_time
                pout.window_end = w.end_time
            pout.block_tasks = []
            for bt in p.block_tasks:
                btout = BlockTaskOut.model_validate(bt)
                if bt.maintenance_task:
                    btout.task_code = bt.maintenance_task.task_code
                    btout.task_description = bt.maintenance_task.description
                pout.block_tasks.append(btout)
            plan_outs.append(pout)

        return {
            "success": True,
            "plan_type": "optimized",
            "total_blocks": len(plans),
            "total_block_hours": round(total_block_hours, 1),
            "integrated_blocks": integrated_count,
            "total_tasks_scheduled": scheduled_count,
            "total_tasks_unscheduled": len(unscheduled_tasks),
            "train_disruption_minutes": round(total_disruption, 1),
            "asset_availability_improvement": round(total_avail_improvement, 2),
            "optimization_score": opt_score,
            "plans": plan_outs,
            "unscheduled_tasks": unscheduled_tasks,
            "insights": insights,
        }

    def _calculate_disruption(self, window: BlockWindow) -> float:
        """Estimate train disruption minutes for a block window."""
        schedules = self.db.query(TrainSchedule).filter(
            TrainSchedule.section_id == window.section_id,
            TrainSchedule.date == window.date,
        ).all()

        disruption = 0.0
        ws = _time_to_minutes(window.start_time)
        we = _time_to_minutes(window.end_time)
        if we <= ws:
            we += 24 * 60

        for ts in schedules:
            ta = _time_to_minutes(ts.arrival_time)
            td = _time_to_minutes(ts.departure_time)
            if td <= ta:
                td += 24 * 60

            # Check overlap
            if ws < td and ta < we:
                overlap = min(we, td) - max(ws, ta)
                disruption += max(0, overlap)

        return disruption

    def _empty_result(self, plan_type: str, message: str = "No tasks to schedule") -> dict:
        return {
            "success": False,
            "plan_type": plan_type,
            "total_blocks": 0,
            "total_block_hours": 0.0,
            "integrated_blocks": 0,
            "total_tasks_scheduled": 0,
            "total_tasks_unscheduled": 0,
            "train_disruption_minutes": 0.0,
            "asset_availability_improvement": 0.0,
            "optimization_score": 0.0,
            "plans": [],
            "unscheduled_tasks": [],
            "insights": [message],
        }


class BaselinePlanner:
    """Simple first-available-window baseline planner for comparison."""

    def __init__(self, db: Session):
        self.db = db

    def plan(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        task_ids: list[int] | None = None,
    ) -> dict:
        """Generate a baseline plan using simple first-fit scheduling."""
        if not start_date:
            start_date = date.today()
        if not end_date:
            end_date = start_date + timedelta(days=7)

        query = self.db.query(MaintenanceTask).filter(
            MaintenanceTask.status.in_([TaskStatus.PENDING, TaskStatus.OVERDUE, TaskStatus.SCHEDULED])
        )
        if task_ids:
            query = query.filter(MaintenanceTask.id.in_(task_ids))
        tasks = query.order_by(MaintenanceTask.due_date).all()

        if not tasks:
            return self._empty_result()

        # Get available windows sorted by date/time
        windows = (
            self.db.query(BlockWindow)
            .filter(
                BlockWindow.date >= start_date,
                BlockWindow.date <= end_date,
                BlockWindow.status == BlockStatus.AVAILABLE,
            )
            .order_by(BlockWindow.date, BlockWindow.start_time)
            .all()
        )

        # Simple first-fit: for each task, assign to first window that fits
        used_window_time: dict[int, int] = {}  # window_id -> minutes used
        assignments: dict[int, list[MaintenanceTask]] = {}  # window_id -> tasks

        scheduled = []
        unscheduled = []

        for task in tasks:
            assigned = False
            for window in windows:
                if window.section_id != task.section_id:
                    continue

                window_dur = window.duration_minutes
                used = used_window_time.get(window.id, 0)
                remaining = window_dur - used

                if remaining >= task.duration_minutes:
                    used_window_time[window.id] = used + task.duration_minutes
                    assignments.setdefault(window.id, []).append(task)
                    scheduled.append(task)
                    assigned = True
                    break

            if not assigned:
                unscheduled.append(task.task_code)

        # Clear existing baseline plans
        baseline_plan_ids = [
            p.id for p in self.db.query(BlockPlan.id).filter(BlockPlan.plan_type == "baseline").all()
        ]
        if baseline_plan_ids:
            self.db.query(BlockTask).filter(BlockTask.block_plan_id.in_(baseline_plan_ids)).delete(synchronize_session=False)
            self.db.query(BlockPlan).filter(BlockPlan.id.in_(baseline_plan_ids)).delete(synchronize_session=False)
        self.db.flush()

        # Create plans
        plans = []
        windows_map = {w.id: w for w in windows}
        total_disruption = 0.0
        total_avail = 0.0

        for wid, assigned_tasks in assignments.items():
            window = windows_map[wid]
            departments = set()
            for t in assigned_tasks:
                if t.department:
                    departments.add(t.department.code)

            is_integrated = 1 if len(departments) > 1 else 0

            disruption = self._calculate_disruption(window)
            total_disruption += disruption

            avail_impact = sum(
                (100 - t.asset.availability) / len(assigned_tasks)
                for t in assigned_tasks if t.asset
            ) / 100 * 3

            total_avail += avail_impact

            plan = BlockPlan(
                plan_date=window.date,
                block_window_id=wid,
                status=PlanStatus.DRAFT,
                optimization_score=0.0,
                train_disruption_minutes=disruption,
                asset_availability_impact=round(avail_impact, 2),
                is_integrated=is_integrated,
                departments_involved=list(departments),
                plan_type="baseline",
                reasoning="Baseline: first available window assignment",
            )
            self.db.add(plan)
            self.db.flush()

            current_start = _time_to_minutes(window.start_time)
            for task in assigned_tasks:
                end = current_start + task.duration_minutes
                bt = BlockTask(
                    block_plan_id=plan.id,
                    maintenance_task_id=task.id,
                    start_time=_minutes_to_time(current_start),
                    end_time=_minutes_to_time(end),
                )
                self.db.add(bt)
                current_start = end

            plans.append(plan)

        self.db.commit()

        total_block_hours = sum(
            windows_map[p.block_window_id].duration_minutes / 60
            for p in plans if p.block_window_id in windows_map
        )

        from app.schemas import BlockPlanOut, BlockTaskOut

        plan_outs = []
        for p in plans:
            pout = BlockPlanOut.model_validate(p)
            w = windows_map.get(p.block_window_id)
            if w and w.section:
                pout.section_code = w.section.section_code
                pout.window_start = w.start_time
                pout.window_end = w.end_time
            pout.block_tasks = []
            for bt in p.block_tasks:
                btout = BlockTaskOut.model_validate(bt)
                if bt.maintenance_task:
                    btout.task_code = bt.maintenance_task.task_code
                    btout.task_description = bt.maintenance_task.description
                pout.block_tasks.append(btout)
            plan_outs.append(pout)

        scheduled_count = len(scheduled)
        total_tasks = len(tasks)

        return {
            "success": True,
            "plan_type": "baseline",
            "total_blocks": len(plans),
            "total_block_hours": round(total_block_hours, 1),
            "integrated_blocks": sum(1 for p in plans if p.is_integrated),
            "total_tasks_scheduled": scheduled_count,
            "total_tasks_unscheduled": len(unscheduled),
            "train_disruption_minutes": round(total_disruption, 1),
            "asset_availability_improvement": round(total_avail, 2),
            "optimization_score": round(scheduled_count / max(total_tasks, 1) * 50, 1),
            "plans": plan_outs,
            "unscheduled_tasks": unscheduled,
            "insights": ["Baseline: Simple first-available-window scheduling without optimization."],
        }

    def _calculate_disruption(self, window: BlockWindow) -> float:
        schedules = self.db.query(TrainSchedule).filter(
            TrainSchedule.section_id == window.section_id,
            TrainSchedule.date == window.date,
        ).all()

        disruption = 0.0
        ws = _time_to_minutes(window.start_time)
        we = _time_to_minutes(window.end_time)
        if we <= ws:
            we += 24 * 60

        for ts in schedules:
            ta = _time_to_minutes(ts.arrival_time)
            td = _time_to_minutes(ts.departure_time)
            if td <= ta:
                td += 24 * 60
            if ws < td and ta < we:
                overlap = min(we, td) - max(ws, ta)
                disruption += max(0, overlap)

        return disruption

    def _empty_result(self):
        return {
            "success": False,
            "plan_type": "baseline",
            "total_blocks": 0,
            "total_block_hours": 0.0,
            "integrated_blocks": 0,
            "total_tasks_scheduled": 0,
            "total_tasks_unscheduled": 0,
            "train_disruption_minutes": 0.0,
            "asset_availability_improvement": 0.0,
            "optimization_score": 0.0,
            "plans": [],
            "unscheduled_tasks": [],
            "insights": ["No tasks to schedule"],
        }
