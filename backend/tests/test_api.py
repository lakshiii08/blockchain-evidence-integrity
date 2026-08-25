"""
Integration Tests for FastAPI Evidence Integrity Endpoints.
"""

import io
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app

# Setup isolated test database
TEST_DB_FILE = "./test_evidence.db"
test_engine = create_engine(f"sqlite:///{TEST_DB_FILE}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["module"] == "blockchain-evidence-integrity"


def test_end_to_end_evidence_lifecycle(client):
    # 1. Register synthetic evidence file
    file_content = b"%PDF-1.4 Synthetic FIR Document Case #991/2026. Suspect vehicle registration XYZ-9988."
    file_obj = io.BytesIO(file_content)

    reg_response = client.post(
        "/api/evidence/register",
        data={
            "evidence_id": "EV-TEST-991",
            "case_id": "CASE-FIR-991"
        },
        files={
            "file": ("CASE_991_FIR.pdf", file_obj, "application/pdf")
        }
    )

    assert reg_response.status_code == 201
    reg_data = reg_response.json()
    assert reg_data["evidence_id"] == "EV-TEST-991"
    assert reg_data["version"] == 1
    assert len(reg_data["sha256"]) == 64
    assert reg_data["transaction_hash"] is not None

    original_sha256 = reg_data["sha256"]

    # 2. Query evidence details
    get_response = client.get("/api/evidence/EV-TEST-991")
    assert get_response.status_code == 200
    assert get_response.json()["sha256"] == original_sha256

    # 3. Verify integrity of stored original file -> Expect VERIFIED
    verify_response = client.get("/api/evidence/EV-TEST-991/verify")
    assert verify_response.status_code == 200
    verify_data = verify_response.json()
    assert verify_data["integrity_status"] == "VERIFIED"
    assert verify_data["is_match"] is True
    assert verify_data["current_hash"] == original_sha256

    # 4. Verify candidate file upload directly
    same_file_obj = io.BytesIO(file_content)
    candidate_verify_resp = client.post(
        "/api/evidence/EV-TEST-991/verify-file",
        files={"file": ("candidate.pdf", same_file_obj, "application/pdf")}
    )
    assert candidate_verify_resp.status_code == 200
    assert candidate_verify_resp.json()["integrity_status"] == "VERIFIED"

    # 5. Simulate illicit file modification / tampering
    tamper_resp = client.post("/api/evidence/simulate-tamper/EV-TEST-991")
    assert tamper_resp.status_code == 200
    assert tamper_resp.json()["new_tampered_hash"] != original_sha256

    # 6. Re-verify after tampering -> Expect POTENTIAL INTEGRITY MISMATCH
    tampered_verify_resp = client.get("/api/evidence/EV-TEST-991/verify")
    assert tampered_verify_resp.status_code == 200
    tampered_data = tampered_verify_resp.json()
    assert tampered_data["integrity_status"] == "POTENTIAL INTEGRITY MISMATCH"
    assert tampered_data["is_match"] is False
    assert tampered_data["current_hash"] != original_sha256
    assert "POTENTIAL INTEGRITY MISMATCH" in tampered_data["explanation"]

    # 7. Check Provenance Trail
    provenance_resp = client.get("/api/evidence/EV-TEST-991/provenance")
    assert provenance_resp.status_code == 200
    prov_data = provenance_resp.json()
    assert prov_data["evidence_id"] == "EV-TEST-991"
    assert len(prov_data["timeline"]) >= 3
    assert len(prov_data["verification_history"]) >= 2

    # 8. Restore original file
    restore_resp = client.post("/api/evidence/restore-file/EV-TEST-991")
    assert restore_resp.status_code == 200

    # 9. Verify restored file -> Expect VERIFIED again
    final_verify_resp = client.get("/api/evidence/EV-TEST-991/verify")
    assert final_verify_resp.status_code == 200
    assert final_verify_resp.json()["integrity_status"] == "VERIFIED"
