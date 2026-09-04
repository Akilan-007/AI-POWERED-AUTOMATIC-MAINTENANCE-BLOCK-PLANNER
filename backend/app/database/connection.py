"""Database connection and session management."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.config import get_settings

settings = get_settings()

db_url = settings.database_url
connect_args = {}
engine_kwargs = {"echo": False}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(db_url, connect_args=connect_args, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
