"""
Pydantic Schemas for API Request Validation and Structured Responses.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class EvidenceBase(BaseModel):
    evidence_id: str = Field(..., description="Unique evidence identifier, e.g. EV-101")
    case_id: str = Field(..., description="Associated case identifier, e.g. CASE-2026-902")


class EvidenceRegisterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    evidence_id: str
    case_id: str
    version: int
    file_name: str
    sha256: str
    blockchain_network: str
    contract_address: Optional[str] = None
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    status: str
    registered_at: datetime
    registered_by: Optional[str] = None
    explorer_url: Optional[str] = None


class VerificationResult(BaseModel):
    evidence_id: str
    version: int
    current_hash: str
    registered_hash: str
    integrity_status: str  # "VERIFIED" or "POTENTIAL INTEGRITY MISMATCH"
    is_match: bool
    verified_at: datetime
    blockchain_network: str
    contract_address: Optional[str] = None
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    explanation: str
    explorer_url: Optional[str] = None


class ProvenanceEvent(BaseModel):
    step_number: int
    stage: str
    description: str
    timestamp: datetime
    actor: str
    details: Dict[str, Any]


class ProvenanceResponse(BaseModel):
    evidence_id: str
    case_id: str
    current_version: int
    sha256_hash: str
    status: str
    timeline: List[ProvenanceEvent]
    verification_history: List[Dict[str, Any]]


class EvidenceVersionItem(BaseModel):
    version: int
    sha256_hash: str
    file_name: str
    registered_at: datetime
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    status: str
