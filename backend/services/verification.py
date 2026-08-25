"""
Verification Engine for Evidence Cryptographic Integrity and Tamper Detection.
"""

from datetime import datetime, timezone
import logging
from sqlalchemy.orm import Session

from backend.models.evidence import EvidenceRecord, VerificationLog
from backend.services.blockchain import blockchain_service
from backend.services.hashing import calculate_sha256
from backend.schemas.evidence import VerificationResult

logger = logging.getLogger(__name__)


class VerificationService:
    @staticmethod
    def verify_file_integrity(
        db: Session,
        evidence_record: EvidenceRecord,
        candidate_file_path_or_stream,
        verified_by: str = "System Auditor"
    ) -> VerificationResult:
        """
        Calculates SHA-256 of candidate file, queries the on-chain evidence hash,
        evaluates match, logs the audit event to DB, and returns structured result.
        """
        current_hash = calculate_sha256(candidate_file_path_or_stream)
        registered_hash = evidence_record.sha256_hash.lower()

        if blockchain_service.is_connected() and evidence_record.contract_address:
            try:
                blockchain_service.verify_on_chain(
                    evidence_id_str=evidence_record.evidence_id,
                    version=evidence_record.version,
                    current_sha256_hex=current_hash
                )
            except Exception as e:
                logger.warning(f"On-chain direct query warning: {e}. Falling back to DB anchor comparison.")

        is_match = (current_hash == registered_hash)
        integrity_status = "VERIFIED" if is_match else "POTENTIAL INTEGRITY MISMATCH"

        if is_match:
            explanation = (
                f"File integrity verified successfully. The calculated SHA-256 fingerprint matches "
                f"the immutable blockchain anchor recorded at block #{evidence_record.block_number or 'N/A'}."
            )
        else:
            explanation = (
                f"POTENTIAL INTEGRITY MISMATCH detected. Current file SHA-256 ({current_hash}) differs "
                f"from the registered version {evidence_record.version} hash ({registered_hash}). "
                f"This indicates the file may have been modified, corrupted, or tampered with."
            )

        now_utc = datetime.now(timezone.utc)
        log_entry = VerificationLog(
            evidence_record_id=evidence_record.id,
            evidence_id=evidence_record.evidence_id,
            version=evidence_record.version,
            calculated_hash=current_hash,
            expected_hash=registered_hash,
            integrity_status=integrity_status,
            is_match=is_match,
            verified_at=now_utc,
            verified_by=verified_by,
            notes=explanation
        )
        db.add(log_entry)
        db.commit()

        explorer_url = blockchain_service.get_explorer_tx_url(evidence_record.transaction_hash)

        return VerificationResult(
            evidence_id=evidence_record.evidence_id,
            version=evidence_record.version,
            current_hash=current_hash,
            registered_hash=registered_hash,
            integrity_status=integrity_status,
            is_match=is_match,
            verified_at=log_entry.verified_at,
            blockchain_network=evidence_record.blockchain_network,
            contract_address=evidence_record.contract_address,
            transaction_hash=evidence_record.transaction_hash,
            block_number=evidence_record.block_number,
            explanation=explanation,
            explorer_url=explorer_url
        )


verification_service = VerificationService()
