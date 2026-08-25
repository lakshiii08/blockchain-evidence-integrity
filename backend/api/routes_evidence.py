"""
FastAPI Routes for Evidence Registration, Verification, Versioning, and Provenance.
"""

import os
import shutil
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.evidence import EvidenceRecord, VerificationLog
from backend.schemas.evidence import (
    EvidenceRegisterResponse,
    VerificationResult,
    ProvenanceResponse,
    ProvenanceEvent,
    EvidenceVersionItem
)
from backend.services.blockchain import blockchain_service
from backend.services.hashing import calculate_sha256
from backend.services.verification import verification_service

router = APIRouter(prefix="/api/evidence", tags=["Evidence Registry"])

STORAGE_DIR = os.getenv("STORAGE_DIR", "./storage/evidence")
os.makedirs(STORAGE_DIR, exist_ok=True)


@router.post("/register", response_model=EvidenceRegisterResponse, status_code=status.HTTP_201_CREATED)
async def register_evidence(
    evidence_id: str = Form(..., description="Unique Evidence ID, e.g. EV-101"),
    case_id: str = Form(..., description="Associated Case ID, e.g. CASE-2026-FIR-902"),
    file: UploadFile = File(..., description="Raw Evidence File (PDF, CDR, Image, etc.)"),
    db: Session = Depends(get_db)
):
    """
    Registers a new evidence file:
    1. Streams SHA-256 checksum without storing PII on-chain.
    2. Stores the file in secure off-chain storage.
    3. Broadcasts registerEvidence transaction to blockchain smart contract.
    4. Records transaction receipt and application metadata in database.
    """
    clean_ev_id = evidence_id.strip()
    clean_case_id = case_id.strip()

    if not clean_ev_id or not clean_case_id:
        raise HTTPException(status_code=400, detail="evidence_id and case_id cannot be empty")

    # Check if evidence_id already exists in DB
    existing = db.query(EvidenceRecord).filter(EvidenceRecord.evidence_id == clean_ev_id).first()
    version = 1 if not existing else (
        db.query(EvidenceRecord).filter(EvidenceRecord.evidence_id == clean_ev_id).count() + 1
    )

    # Prepare storage path
    ev_storage_dir = os.path.join(STORAGE_DIR, clean_ev_id, f"v{version}")
    os.makedirs(ev_storage_dir, exist_ok=True)
    target_file_path = os.path.join(ev_storage_dir, file.filename or "evidence.bin")

    # Save uploaded file
    with open(target_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Calculate streaming SHA-256
    sha256_hash = calculate_sha256(target_file_path)

    # Create initial DB record (PENDING status)
    now_utc = datetime.now(timezone.utc)
    record = EvidenceRecord(
        evidence_id=clean_ev_id,
        case_id=clean_case_id,
        version=version,
        file_name=file.filename or "evidence.bin",
        file_path=target_file_path,
        file_size_bytes=os.path.getsize(target_file_path),
        mime_type=file.content_type or "application/octet-stream",
        sha256_hash=sha256_hash,
        blockchain_network=blockchain_service.network_name,
        contract_address=blockchain_service.contract_address,
        status="PENDING",
        registered_at=now_utc
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # Submit transaction to blockchain
    try:
        if blockchain_service.is_connected() and blockchain_service.account and blockchain_service.contract:
            tx_result = blockchain_service.register_evidence(clean_ev_id, sha256_hash)
            record.transaction_hash = tx_result["transaction_hash"]
            record.block_number = tx_result["block_number"]
            record.registered_by = tx_result["registered_by"]
            record.version = tx_result["version"]
            record.status = "CONFIRMED"
            db.commit()
        else:
            # Local demo fallback mode if blockchain RPC is not actively running
            record.status = "CONFIRMED (DEMO)"
            record.transaction_hash = f"0x{os.urandom(32).hex()}"
            record.block_number = 123456 + record.id
            record.registered_by = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
            db.commit()
    except Exception as e:
        record.status = "FAILED"
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Blockchain transaction failed: {str(e)}"
        )

    explorer_url = blockchain_service.get_explorer_tx_url(record.transaction_hash)

    return EvidenceRegisterResponse(
        evidence_id=record.evidence_id,
        case_id=record.case_id,
        version=record.version,
        file_name=record.file_name,
        sha256=record.sha256_hash,
        blockchain_network=record.blockchain_network,
        contract_address=record.contract_address,
        transaction_hash=record.transaction_hash,
        block_number=record.block_number,
        status=record.status,
        registered_at=record.registered_at,
        registered_by=record.registered_by,
        explorer_url=explorer_url
    )


@router.get("", response_model=List[EvidenceRegisterResponse])
def list_all_evidence(db: Session = Depends(get_db)):
    """Lists all registered evidence records (grouped by unique evidence ID, showing latest)."""
    records = db.query(EvidenceRecord).order_by(EvidenceRecord.registered_at.desc()).all()
    results = []
    seen = set()
    for r in records:
        if r.evidence_id not in seen:
            seen.add(r.evidence_id)
            results.append(EvidenceRegisterResponse(
                evidence_id=r.evidence_id,
                case_id=r.case_id,
                version=r.version,
                file_name=r.file_name,
                sha256=r.sha256_hash,
                blockchain_network=r.blockchain_network,
                contract_address=r.contract_address,
                transaction_hash=r.transaction_hash,
                block_number=r.block_number,
                status=r.status,
                registered_at=r.registered_at,
                registered_by=r.registered_by,
                explorer_url=blockchain_service.get_explorer_tx_url(r.transaction_hash)
            ))
    return results


@router.get("/{evidence_id}", response_model=EvidenceRegisterResponse)
def get_evidence_details(
    evidence_id: str,
    version: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Retrieves metadata and blockchain anchor details for a specific evidence item."""
    query = db.query(EvidenceRecord).filter(EvidenceRecord.evidence_id == evidence_id)
    if version:
        query = query.filter(EvidenceRecord.version == version)
    else:
        query = query.order_by(EvidenceRecord.version.desc())

    record = query.first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found")

    return EvidenceRegisterResponse(
        evidence_id=record.evidence_id,
        case_id=record.case_id,
        version=record.version,
        file_name=record.file_name,
        sha256=record.sha256_hash,
        blockchain_network=record.blockchain_network,
        contract_address=record.contract_address,
        transaction_hash=record.transaction_hash,
        block_number=record.block_number,
        status=record.status,
        registered_at=record.registered_at,
        registered_by=record.registered_by,
        explorer_url=blockchain_service.get_explorer_tx_url(record.transaction_hash)
    )


@router.get("/{evidence_id}/verify", response_model=VerificationResult)
def verify_stored_evidence(
    evidence_id: str,
    version: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Verifies the integrity of the stored evidence file against the immutable blockchain anchor.
    """
    query = db.query(EvidenceRecord).filter(EvidenceRecord.evidence_id == evidence_id)
    if version:
        query = query.filter(EvidenceRecord.version == version)
    else:
        query = query.order_by(EvidenceRecord.version.desc())

    record = query.first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found")

    if not os.path.exists(record.file_path):
        raise HTTPException(status_code=404, detail=f"Evidence file missing on server storage: {record.file_path}")

    return verification_service.verify_file_integrity(
        db=db,
        evidence_record=record,
        candidate_file_path_or_stream=record.file_path,
        verified_by="Investigator Verification Engine"
    )


@router.post("/{evidence_id}/verify-file", response_model=VerificationResult)
async def verify_uploaded_evidence_candidate(
    evidence_id: str,
    file: UploadFile = File(..., description="Candidate file to verify"),
    version: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Verifies an uploaded candidate file against the on-chain registered fingerprint.
    """
    query = db.query(EvidenceRecord).filter(EvidenceRecord.evidence_id == evidence_id)
    if version:
        query = query.filter(EvidenceRecord.version == version)
    else:
        query = query.order_by(EvidenceRecord.version.desc())

    record = query.first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found")

    return verification_service.verify_file_integrity(
        db=db,
        evidence_record=record,
        candidate_file_path_or_stream=file.file,
        verified_by="External Verifier / Court Auditor"
    )


@router.get("/{evidence_id}/versions", response_model=List[EvidenceVersionItem])
def list_evidence_versions(evidence_id: str, db: Session = Depends(get_db)):
    """Lists all registered versions for an evidence item."""
    records = (
        db.query(EvidenceRecord)
        .filter(EvidenceRecord.evidence_id == evidence_id)
        .order_by(EvidenceRecord.version.asc())
        .all()
    )
    if not records:
        raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found")

    return [
        EvidenceVersionItem(
            version=r.version,
            sha256_hash=r.sha256_hash,
            file_name=r.file_name,
            registered_at=r.registered_at,
            transaction_hash=r.transaction_hash,
            block_number=r.block_number,
            status=r.status
        )
        for r in records
    ]


@router.get("/{evidence_id}/provenance", response_model=ProvenanceResponse)
def get_evidence_provenance(evidence_id: str, db: Session = Depends(get_db)):
    """
    Generates a full chronological provenance audit trail from initial upload
    to blockchain transaction confirmation and historical verification events.
    """
    records = (
        db.query(EvidenceRecord)
        .filter(EvidenceRecord.evidence_id == evidence_id)
        .order_by(EvidenceRecord.version.asc())
        .all()
    )
    if not records:
        raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found")

    latest_record = records[-1]
    timeline: List[ProvenanceEvent] = []
    step = 1

    for r in records:
        # Step: Upload & Hashing
        timeline.append(ProvenanceEvent(
            step_number=step,
            stage="EVIDENCE_INGESTION",
            description=f"Evidence version {r.version} ('{r.file_name}') uploaded & SHA-256 computed.",
            timestamp=r.registered_at,
            actor="Investigative Officer",
            details={
                "version": r.version,
                "file_name": r.file_name,
                "sha256": r.sha256_hash,
                "file_size": r.file_size_bytes
            }
        ))
        step += 1

        # Step: Blockchain Anchoring
        timeline.append(ProvenanceEvent(
            step_number=step,
            stage="BLOCKCHAIN_ANCHOR",
            description=f"Fingerprint anchored into smart contract on {r.blockchain_network}.",
            timestamp=r.registered_at,
            actor=r.registered_by or "Registrar Wallet",
            details={
                "contract_address": r.contract_address,
                "transaction_hash": r.transaction_hash,
                "block_number": r.block_number,
                "status": r.status
            }
        ))
        step += 1

    # Verification logs
    logs = (
        db.query(VerificationLog)
        .filter(VerificationLog.evidence_id == evidence_id)
        .order_by(VerificationLog.verified_at.asc())
        .all()
    )

    for l in logs:
        timeline.append(ProvenanceEvent(
            step_number=step,
            stage="INTEGRITY_VERIFICATION",
            description=f"Integrity check performed: {l.integrity_status}",
            timestamp=l.verified_at,
            actor=l.verified_by,
            details={
                "version": l.version,
                "status": l.integrity_status,
                "calculated_hash": l.calculated_hash,
                "expected_hash": l.expected_hash,
                "is_match": l.is_match
            }
        ))
        step += 1

    return ProvenanceResponse(
        evidence_id=latest_record.evidence_id,
        case_id=latest_record.case_id,
        current_version=latest_record.version,
        sha256_hash=latest_record.sha256_hash,
        status=latest_record.status,
        timeline=timeline,
        verification_history=[
            {
                "id": log.id,
                "version": log.version,
                "integrity_status": log.integrity_status,
                "is_match": log.is_match,
                "calculated_hash": log.calculated_hash,
                "expected_hash": log.expected_hash,
                "verified_at": log.verified_at.isoformat(),
                "verified_by": log.verified_by,
                "notes": log.notes
            }
            for log in logs
        ]
    )


# Demo Tamper Simulation Endpoints
@router.post("/simulate-tamper/{evidence_id}")
@router.post("/demo/simulate-tamper/{evidence_id}")
def simulate_tampering(evidence_id: str, db: Session = Depends(get_db)):
    """
    Demonstration helper: Modifies 1 byte in the stored file to simulate illicit tampering.
    Allows live demonstration of the tamper detection engine.
    """
    record = (
        db.query(EvidenceRecord)
        .filter(EvidenceRecord.evidence_id == evidence_id)
        .order_by(EvidenceRecord.version.desc())
        .first()
    )
    if not record or not os.path.exists(record.file_path):
        raise HTTPException(status_code=404, detail="Evidence file not found")

    backup_path = record.file_path + ".original.bak"
    if not os.path.exists(backup_path):
        shutil.copyfile(record.file_path, backup_path)

    with open(record.file_path, "r+b") as f:
        f.seek(0)
        first_byte = f.read(1)
        altered_byte = bytes([first_byte[0] ^ 0xFF]) if first_byte else b"\xFF"
        f.seek(0)
        f.write(altered_byte)

    new_hash = calculate_sha256(record.file_path)
    return {
        "message": "File tampering simulated successfully by altering 1 byte in storage.",
        "evidence_id": evidence_id,
        "original_registered_hash": record.sha256_hash,
        "new_tampered_hash": new_hash,
        "instruction": "Now call GET /api/evidence/{evidence_id}/verify to see the POTENTIAL INTEGRITY MISMATCH alert."
    }


@router.post("/restore-file/{evidence_id}")
@router.post("/demo/restore-file/{evidence_id}")
def restore_file(evidence_id: str, db: Session = Depends(get_db)):
    """Restores the original file after a simulated tamper test."""
    record = (
        db.query(EvidenceRecord)
        .filter(EvidenceRecord.evidence_id == evidence_id)
        .order_by(EvidenceRecord.version.desc())
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Evidence not found")

    backup_path = record.file_path + ".original.bak"
    if os.path.exists(backup_path):
        shutil.copyfile(backup_path, record.file_path)
        return {"message": "Original evidence file restored successfully."}
    return {"message": "No backup found; file is unchanged."}
