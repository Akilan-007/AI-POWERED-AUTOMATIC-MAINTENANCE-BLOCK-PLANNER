"""Train and TrainSchedule models."""

from sqlalchemy import Column, Integer, String, Time, Date, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from app.database.base import Base


class TrainType(str, enum.Enum):
    RAJDHANI = "Rajdhani"
    SHATABDI = "Shatabdi"
    DURONTO = "Duronto"
    SUPERFAST = "Superfast"
    EXPRESS = "Express"
    PASSENGER = "Passenger"
    GOODS = "Goods"
    SPECIAL = "Special"


class TrainPriority(str, enum.Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class TrainDirection(str, enum.Enum):
    UP = "Up"
    DOWN = "Down"


class Train(Base):
    """Railway train."""

    __tablename__ = "trains"

    id = Column(Integer, primary_key=True, autoincrement=True)
    train_number = Column(String(10), unique=True, nullable=False)
    train_name = Column(String(200), nullable=False)
    train_type = Column(SQLEnum(TrainType), nullable=False)
    priority = Column(SQLEnum(TrainPriority), nullable=False, default=TrainPriority.MEDIUM)

    # Relationships
    schedules = relationship("TrainSchedule", back_populates="train")

    def __repr__(self):
        return f"<Train(number='{self.train_number}', name='{self.train_name}')>"


class TrainSchedule(Base):
    """Train schedule entry for a specific section."""

    __tablename__ = "train_schedules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    train_id = Column(Integer, ForeignKey("trains.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("track_sections.id"), nullable=False)
    station_from = Column(String(100), nullable=False)
    station_to = Column(String(100), nullable=False)
    arrival_time = Column(Time, nullable=False)
    departure_time = Column(Time, nullable=False)
    direction = Column(SQLEnum(TrainDirection), nullable=False)
    date = Column(Date, nullable=False)

    # Relationships
    train = relationship("Train", back_populates="schedules")
    section = relationship("TrackSection", back_populates="train_schedules")

    def __repr__(self):
        return f"<TrainSchedule(train_id={self.train_id}, section={self.station_from}->{self.station_to})>"
