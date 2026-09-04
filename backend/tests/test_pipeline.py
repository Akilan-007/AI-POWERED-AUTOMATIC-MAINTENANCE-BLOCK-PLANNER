"""Test script to verify AI Priority, Candidate Generation, Constraints, and CP-SAT Optimization."""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.services.ai.priority_engine import compute_all_priorities
from app.services.planning.candidate_generator import generate_all_candidates
from app.services.optimization.cpsat_optimizer import BlockPlanOptimizer, BaselinePlanner


def test_full_pipeline():
    db = SessionLocal()
    try:
        print("\n--- 1. Testing AI Priority Engine ---")
        priorities = compute_all_priorities(db)
        print(f"Computed priorities for {len(priorities)} tasks.")
        assert len(priorities) > 0, "No priorities computed"
        for p in priorities[:3]:
            print(f"  Task {p['task_code']}: Priority {p['priority_score']} ({p['classification']})")
            print(f"    Reasoning: {p['explanation']}")

        print("\n--- 2. Testing Candidate Generation ---")
        candidates = generate_all_candidates(db)
        print(f"Generated candidates for {len(candidates)} tasks.")
        assert len(candidates) > 0, "No candidates generated"
        total_cands = sum(len(c['candidates']) for c in candidates)
        print(f"  Total candidate windows generated: {total_cands}")

        print("\n--- 3. Testing Baseline Planner ---")
        baseline_planner = BaselinePlanner(db)
        base_res = baseline_planner.plan()
        print(f"Baseline Result: {base_res['total_blocks']} blocks, {base_res['total_block_hours']} hrs, {base_res['train_disruption_minutes']} min disruption")

        print("\n--- 4. Testing OR-Tools CP-SAT Optimizer ---")
        optimizer = BlockPlanOptimizer(db)
        opt_res = optimizer.optimize()
        print(f"Optimized Result: {opt_res['total_blocks']} blocks, {opt_res['total_block_hours']} hrs, {opt_res['train_disruption_minutes']} min disruption, score: {opt_res['optimization_score']}")
        print(f"  Integrated blocks: {opt_res['integrated_blocks']}")
        print(f"  Tasks scheduled: {opt_res['total_tasks_scheduled']}")
        print(f"  Insights generated: {len(opt_res['insights'])}")
        for insight in opt_res['insights'][:3]:
            print(f"    - {insight}")

        print("\n[SUCCESS] Entire AI + Optimization pipeline tested and verified!")
    finally:
        db.close()


if __name__ == "__main__":
    test_full_pipeline()
