"""MaintenanceHistory model."""

from sqlalchemy import Column, Integer, Float, Date, ForeignKey
from sqlalchemy.orm import relationship

from app.database.base import Base


class MaintenanceHistory(Base):
    """Historical record of completed maintenance."""

    __tablename__ = "maintenance_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    maintenance_task_id = Column(Integer, ForeignKey("maintenance_tasks.id"), nullable=True)
    completed_date = Column(Date, nullable=False)
    downtime_minutes = Column(Integer, default=0)
    condition_before = Column(Float, default=0.0)  # 0-100
    condition_after = Column(Float, default=0.0)  # 0-100

    # Relationships
    asset = relationship("Asset", back_populates="maintenance_history")
    maintenance_task = relationship("MaintenanceTask", back_populates="maintenance_history")

    def __repr__(self):
        return f"<MaintenanceHistory(asset={self.asset_id}, date={self.completed_date})>"
