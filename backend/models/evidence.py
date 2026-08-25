"""
SQLAlchemy ORM Models for Evidence Registry Application State and Verification Audit Trail.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class EvidenceRecord(Base):
    """
    Stores off-chain application metadata, case links, file paths, and blockchain receipt anchors.
    """
    __tablename__ = "evidence_records"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(String(100), index=True, nullable=False) # e.g. "EV-2026-101"
    case_id = Column(String(100), index=True, nullable=False)     # e.g. "CASE-FIR-902"
    version = Column(Integer, default=1, nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    mime_type = Column(String(100), default="application/octet-stream")
    sha256_hash = Column(String(64), nullable=False, index=True)

    # Blockchain Anchoring State
    blockchain_network = Column(String(50), default="Polygon Amoy")
    contract_address = Column(String(42), nullable=True)
    transaction_hash = Column(String(66), nullable=True, index=True)
    block_number = Column(Integer, nullable=True)
    status = Column(String(20), default="PENDING") # PENDING, CONFIRMED, FAILED
    registered_at = Column(DateTime, default=datetime.utcnow)
    registered_by = Column(String(42), nullable=True) # Wallet address

    # Relationships
    verification_logs = relationship("VerificationLog", back_populates="evidence_record", cascade="all, delete-orphan")


class VerificationLog(Base):
    """
    Maintains an immutable historical audit trail of every integrity verification performed.
    """
    __tablename__ = "verification_logs"

    id = Column(Integer, primary_key=True, index=True)
    evidence_record_id = Column(Integer, ForeignKey("evidence_records.id"), nullable=False)
    evidence_id = Column(String(100), index=True, nullable=False)
    version = Column(Integer, nullable=False)

    calculated_hash = Column(String(64), nullable=False)
    expected_hash = Column(String(64), nullable=False)
    integrity_status = Column(String(50), nullable=False) # "VERIFIED" or "POTENTIAL INTEGRITY MISMATCH"
    is_match = Column(Boolean, default=False)
    
    verified_at = Column(DateTime, default=datetime.utcnow)
    verified_by = Column(String(100), default="System Auditor")
    notes = Column(Text, nullable=True)

    evidence_record = relationship("EvidenceRecord", back_populates="verification_logs")
