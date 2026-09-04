"""PlanningConstraint model."""

from sqlalchemy import Column, Integer, String, Boolean, Float, JSON

from app.database.base import Base


class PlanningConstraint(Base):
    """Configurable planning constraint."""

    __tablename__ = "planning_constraints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    constraint_type = Column(String(50), nullable=False)
    description = Column(String(500), nullable=False)
    enabled = Column(Boolean, default=True)
    value = Column(JSON, default=dict)  # Constraint parameters
    priority = Column(Integer, default=1)  # Constraint priority/weight

    def __repr__(self):
        return f"<PlanningConstraint(type='{self.constraint_type}', enabled={self.enabled})>"
