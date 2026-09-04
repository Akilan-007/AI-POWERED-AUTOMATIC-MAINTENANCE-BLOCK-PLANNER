"""Corridor and TrackSection models."""

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.database.base import Base


class Corridor(Base):
    """Railway corridor (e.g., Delhi-Agra corridor)."""

    __tablename__ = "corridors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    corridor_code = Column(String(20), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(String(500))

    # Relationships
    track_sections = relationship("TrackSection", back_populates="corridor")

    def __repr__(self):
        return f"<Corridor(code='{self.corridor_code}', name='{self.name}')>"


class TrackSection(Base):
    """A section of track between two stations."""

    __tablename__ = "track_sections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    corridor_id = Column(Integer, ForeignKey("corridors.id"), nullable=False)
    section_code = Column(String(20), unique=True, nullable=False)
    from_station = Column(String(100), nullable=False)
    to_station = Column(String(100), nullable=False)
    from_station_code = Column(String(10), nullable=False)
    to_station_code = Column(String(10), nullable=False)
    length_km = Column(Float, nullable=False)
    available = Column(Boolean, default=True)
    # Synthetic coordinates for map visualization
    from_lat = Column(Float)
    from_lng = Column(Float)
    to_lat = Column(Float)
    to_lng = Column(Float)

    # Relationships
    corridor = relationship("Corridor", back_populates="track_sections")
    assets = relationship("Asset", back_populates="section")
    block_windows = relationship("BlockWindow", back_populates="section")
    train_schedules = relationship("TrainSchedule", back_populates="section")
    maintenance_tasks = relationship("MaintenanceTask", back_populates="section")

    def __repr__(self):
        return f"<TrackSection(code='{self.section_code}', {self.from_station}->{self.to_station})>"
