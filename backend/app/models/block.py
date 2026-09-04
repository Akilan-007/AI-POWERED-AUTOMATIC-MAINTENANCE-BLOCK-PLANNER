"""Block planning models: BlockWindow, BlockPlan, BlockTask."""

from sqlalchemy import Column, Integer, String, Float, Date, Time, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
import enum

from app.database.base import Base


class BlockStatus(str, enum.Enum):
    AVAILABLE = "Available"
    PLANNED = "Planned"
    ACTIVE = "Active"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


class PlanStatus(str, enum.Enum):
    DRAFT = "Draft"
    OPTIMIZED = "Optimized"
    APPROVED = "Approved"
    EXECUTED = "Executed"
    CANCELLED = "Cancelled"


class BlockWindow(Base):
    """Available time window for maintenance blocks on a section."""

    __tablename__ = "block_windows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    section_id = Column(Integer, ForeignKey("track_sections.id"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    capacity = Column(Integer, default=1)  # How many parallel activities
    status = Column(SQLEnum(BlockStatus), nullable=False, default=BlockStatus.AVAILABLE)

    # Relationships
    section = relationship("TrackSection", back_populates="block_windows")
    block_plans = relationship("BlockPlan", back_populates="block_window")

    @property
    def duration_minutes(self):
        """Calculate window duration in minutes."""
        from datetime import datetime, timedelta
        start_dt = datetime.combine(self.date, self.start_time)
        end_dt = datetime.combine(self.date, self.end_time)
        if end_dt < start_dt:
            end_dt += timedelta(days=1)
        return int((end_dt - start_dt).total_seconds() / 60)

    def __repr__(self):
        return f"<BlockWindow(section={self.section_id}, {self.date} {self.start_time}-{self.end_time})>"


class BlockPlan(Base):
    """An optimized maintenance block plan."""

    __tablename__ = "block_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_date = Column(Date, nullable=False)
    block_window_id = Column(Integer, ForeignKey("block_windows.id"), nullable=False)
    status = Column(SQLEnum(PlanStatus), nullable=False, default=PlanStatus.DRAFT)
    optimization_score = Column(Float, default=0.0)
    train_disruption_minutes = Column(Float, default=0.0)
    asset_availability_impact = Column(Float, default=0.0)
    is_integrated = Column(Integer, default=0)  # 1 if multi-department block
    departments_involved = Column(JSON, default=list)  # e.g., ["ENG", "TD", "SNT"]
    plan_type = Column(String(20), default="optimized")  # "optimized" or "baseline"
    reasoning = Column(String(1000))  # Why this block was selected

    # Relationships
    block_window = relationship("BlockWindow", back_populates="block_plans")
    block_tasks = relationship("BlockTask", back_populates="block_plan", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<BlockPlan(id={self.id}, date={self.plan_date}, score={self.optimization_score})>"


class BlockTask(Base):
    """A maintenance task assigned to a block plan."""

    __tablename__ = "block_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    block_plan_id = Column(Integer, ForeignKey("block_plans.id", ondelete="CASCADE"), nullable=False)
    maintenance_task_id = Column(Integer, ForeignKey("maintenance_tasks.id"), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    # Relationships
    block_plan = relationship("BlockPlan", back_populates="block_tasks")
    maintenance_task = relationship("MaintenanceTask", back_populates="block_tasks")

    def __repr__(self):
        return f"<BlockTask(plan={self.block_plan_id}, task={self.maintenance_task_id})>"
