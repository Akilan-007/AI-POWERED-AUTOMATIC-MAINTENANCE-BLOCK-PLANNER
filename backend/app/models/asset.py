"""Asset model."""

from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from app.database.base import Base


class AssetType(str, enum.Enum):
    TRACK = "Track"
    SIGNAL = "Signal"
    OHE = "OHE"
    SWITCH = "Switch"
    BRIDGE = "Bridge"
    LEVEL_CROSSING = "Level Crossing"
    TELECOM = "Telecom"
    SUBSTATION = "Substation"


class AssetStatus(str, enum.Enum):
    OPERATIONAL = "Operational"
    DEGRADED = "Degraded"
    UNDER_MAINTENANCE = "Under Maintenance"
    FAILED = "Failed"
    DECOMMISSIONED = "Decommissioned"


class CriticalityLevel(str, enum.Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Asset(Base):
    """Railway asset (track, signal, OHE, switch, etc.)."""

    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_code = Column(String(20), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    asset_type = Column(SQLEnum(AssetType), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    location = Column(String(200))
    section_id = Column(Integer, ForeignKey("track_sections.id"), nullable=False)
    criticality = Column(SQLEnum(CriticalityLevel), nullable=False, default=CriticalityLevel.MEDIUM)
    condition_score = Column(Float, nullable=False, default=80.0)  # 0-100
    availability = Column(Float, nullable=False, default=100.0)  # percentage
    last_maintenance_date = Column(Date)
    next_due_date = Column(Date)
    status = Column(SQLEnum(AssetStatus), nullable=False, default=AssetStatus.OPERATIONAL)
    # Position along section for map (0.0 to 1.0)
    position_on_section = Column(Float, default=0.5)

    # Relationships
    department = relationship("Department", back_populates="assets")
    section = relationship("TrackSection", back_populates="assets")
    maintenance_tasks = relationship("MaintenanceTask", back_populates="asset")
    maintenance_history = relationship("MaintenanceHistory", back_populates="asset")

    def __repr__(self):
        return f"<Asset(code='{self.asset_code}', type='{self.asset_type}', status='{self.status}')>"
