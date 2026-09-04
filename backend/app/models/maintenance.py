"""MaintenanceTask model."""

from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
import enum

from app.database.base import Base


class MaintenanceType(str, enum.Enum):
    PREVENTIVE = "Preventive"
    CORRECTIVE = "Corrective"
    PREDICTIVE = "Predictive"
    EMERGENCY = "Emergency"
    ROUTINE = "Routine"


class TaskStatus(str, enum.Enum):
    PENDING = "Pending"
    SCHEDULED = "Scheduled"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"
    OVERDUE = "Overdue"


class UrgencyLevel(str, enum.Enum):
    IMMEDIATE = "Immediate"
    URGENT = "Urgent"
    NORMAL = "Normal"
    PLANNED = "Planned"


class MaintenanceTask(Base):
    """Maintenance task requested by a department."""

    __tablename__ = "maintenance_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_code = Column(String(20), unique=True, nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("track_sections.id"), nullable=False)
    maintenance_type = Column(SQLEnum(MaintenanceType), nullable=False)
    description = Column(String(500), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    priority = Column(Integer, default=50)  # 0-100 computed by AI
    criticality = Column(String(20), nullable=False, default="Medium")
    urgency = Column(SQLEnum(UrgencyLevel), nullable=False, default=UrgencyLevel.NORMAL)
    due_date = Column(Date, nullable=False)
    status = Column(SQLEnum(TaskStatus), nullable=False, default=TaskStatus.PENDING)
    required_resources = Column(JSON, default=dict)  # e.g., {"crew": 5, "equipment": ["tamping_machine"]}
    priority_explanation = Column(String(500))  # AI-generated explanation

    # Relationships
    asset = relationship("Asset", back_populates="maintenance_tasks")
    department = relationship("Department", back_populates="maintenance_tasks")
    section = relationship("TrackSection", back_populates="maintenance_tasks")
    block_tasks = relationship("BlockTask", back_populates="maintenance_task")
    maintenance_history = relationship("MaintenanceHistory", back_populates="maintenance_task")

    def __repr__(self):
        return f"<MaintenanceTask(code='{self.task_code}', priority={self.priority}, status='{self.status}')>"
