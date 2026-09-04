"""Models package - exports all models for easy import."""

from app.database.base import Base

from .department import Department
from .corridor import Corridor, TrackSection
from .asset import Asset, AssetType, AssetStatus, CriticalityLevel
from .train import Train, TrainSchedule, TrainType, TrainPriority, TrainDirection
from .maintenance import MaintenanceTask, MaintenanceType, TaskStatus, UrgencyLevel
from .block import BlockWindow, BlockPlan, BlockTask, BlockStatus, PlanStatus
from .constraint import PlanningConstraint
from .history import MaintenanceHistory

__all__ = [
    "Base",
    # Core models
    "Department",
    "Corridor",
    "TrackSection",
    "Asset",
    "Train",
    "TrainSchedule",
    "MaintenanceTask",
    "BlockWindow",
    "BlockPlan",
    "BlockTask",
    "PlanningConstraint",
    "MaintenanceHistory",
    # Enums
    "AssetType",
    "AssetStatus",
    "CriticalityLevel",
    "TrainType",
    "TrainPriority",
    "TrainDirection",
    "MaintenanceType",
    "TaskStatus",
    "UrgencyLevel",
    "BlockStatus",
    "PlanStatus",
]
