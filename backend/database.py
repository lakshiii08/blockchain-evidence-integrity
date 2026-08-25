"""
Database setup for Evidence Application Metadata & Audit Trail.
Supports PostgreSQL (production) with automatic fallback to SQLite (local development).
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./evidence_registry.db")

# For SQLite, ensure check_same_thread is False
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency injection helper for FastAPI database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
