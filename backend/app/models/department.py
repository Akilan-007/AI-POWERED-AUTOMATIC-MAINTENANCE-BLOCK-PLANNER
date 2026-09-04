"""Department model."""

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.database.base import Base


class Department(Base):
    """Railway department (Engineering, Traction Distribution, S&T)."""

    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    code = Column(String(10), unique=True, nullable=False)
    description = Column(String(500))

    # Relationships
    assets = relationship("Asset", back_populates="department")
    maintenance_tasks = relationship("MaintenanceTask", back_populates="department")

    def __repr__(self):
        return f"<Department(code='{self.code}', name='{self.name}')>"
