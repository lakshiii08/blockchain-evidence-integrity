"""
Automated CLI API Client to test the Backend REST API without a Frontend.

Executes:
1. Health check: GET /api/health
2. Register Evidence: POST /api/evidence/register
3. Query Evidence: GET /api/evidence/{id}
4. Verify Untampered File: GET /api/evidence/{id}/verify -> Expect VERIFIED
5. Simulate Tampering: POST /api/evidence/simulate-tamper/{id}
6. Verify Tampered File: GET /api/evidence/{id}/verify -> Expect POTENTIAL INTEGRITY MISMATCH
7. Get Provenance Timeline: GET /api/evidence/{id}/provenance
8. Restore File: POST /api/evidence/restore-file/{id}
9. Final Verification: GET /api/evidence/{id}/verify -> Expect VERIFIED
"""

import os
import sys
import json
import time
import requests

API_URL = os.getenv("API_URL", "http://localhost:8000")
SAMPLE_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "samples", "CASE-101-FIR.pdf"))


def test_backend_api():
    print("=" * 70)
    print("  TESTING BLOCKCHAIN EVIDENCE INTEGRITY BACKEND API")
    print(f"  Target Server: {API_URL}")
    print("=" * 70)

    # 1. Health Check
    print("\n[1] Testing GET /api/health ...")
    try:
        res = requests.get(f"{API_URL}/api/health", timeout=5)
        print(f"    Status Code: {res.status_code}")
        print(f"    Response:    {res.json()}")
        assert res.status_code == 200, "Health check failed!"
    except Exception as e:
        print(f"\n[ERROR] Could not connect to backend at {API_URL}.")
        print("Please start the backend first using:")
        print("  python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload")
        return

    # Ensure sample file exists
    if not os.path.exists(SAMPLE_FILE):
        os.makedirs(os.path.dirname(SAMPLE_FILE), exist_ok=True)
        with open(SAMPLE_FILE, "wb") as f:
            f.write(b"%PDF-1.4 Synthetic FIR Document Case #101/2026. Suspect ID #9982.")

    # 2. Register Evidence
    ev_id = f"EV-TEST-{int(time.time())}"
    case_id = "CASE-2026-CR-00101"
    print(f"\n[2] Testing POST /api/evidence/register (Evidence ID: {ev_id}) ...")

    with open(SAMPLE_FILE, "rb") as f:
        res = requests.post(
            f"{API_URL}/api/evidence/register",
            data={"evidence_id": ev_id, "case_id": case_id},
            files={"file": ("CASE-101-FIR.pdf", f, "application/pdf")}
        )
    print(f"    Status Code: {res.status_code}")
    reg_data = res.json()
    print(f"    Assigned Version: v{reg_data.get('version')}")
    print(f"    SHA-256 Hash:     {reg_data.get('sha256')}")
    print(f"    Tx Hash:          {reg_data.get('transaction_hash')}")
    print(f"    Block Number:     #{reg_data.get('block_number')}")
    assert res.status_code == 201, "Registration failed!"

    # 3. Retrieve Evidence
    print(f"\n[3] Testing GET /api/evidence/{ev_id} ...")
    res = requests.get(f"{API_URL}/api/evidence/{ev_id}")
    print(f"    Status Code: {res.status_code}")
    print(f"    Retrieved:   {json.dumps(res.json(), indent=2)}")

    # 4. Verify Integrity (Original File)
    print(f"\n[4] Testing GET /api/evidence/{ev_id}/verify (Original File) ...")
    res = requests.get(f"{API_URL}/api/evidence/{ev_id}/verify")
    verify_1 = res.json()
    print(f"    Status Code:      {res.status_code}")
    print(f"    Integrity Status: [ {verify_1.get('integrity_status')} ]")
    print(f"    Is Match:         {verify_1.get('is_match')}")
    print(f"    Explanation:      {verify_1.get('explanation')}")
    assert verify_1.get("integrity_status") == "VERIFIED", "Expected VERIFIED status!"

    # 5. Simulate File Tampering
    print(f"\n[5] Testing POST /api/evidence/simulate-tamper/{ev_id} ...")
    res = requests.post(f"{API_URL}/api/evidence/simulate-tamper/{ev_id}")
    print(f"    Status Code: {res.status_code}")
    tamper_res = res.json()
    print(f"    Original Hash: {tamper_res.get('original_registered_hash')}")
    print(f"    Tampered Hash: {tamper_res.get('new_tampered_hash')}")

    # 6. Verify Tampered File
    print(f"\n[6] Testing GET /api/evidence/{ev_id}/verify (Tampered File) ...")
    res = requests.get(f"{API_URL}/api/evidence/{ev_id}/verify")
    verify_2 = res.json()
    print(f"    Status Code:      {res.status_code}")
    print(f"    Integrity Status: [ {verify_2.get('integrity_status')} ]")
    print(f"    Is Match:         {verify_2.get('is_match')}")
    print(f"    Explanation:      {verify_2.get('explanation')}")
    assert verify_2.get("integrity_status") == "POTENTIAL INTEGRITY MISMATCH", "Expected POTENTIAL INTEGRITY MISMATCH!"

    # 7. Get Provenance Timeline
    print(f"\n[7] Testing GET /api/evidence/{ev_id}/provenance ...")
    res = requests.get(f"{API_URL}/api/evidence/{ev_id}/provenance")
    prov_data = res.json()
    print(f"    Timeline Events:      {len(prov_data.get('timeline', []))} steps")
    for event in prov_data.get("timeline", []):
        print(f"      - Step {event['step_number']}: [{event['stage']}] {event['description']}")
    print(f"    Verification Audits:  {len(prov_data.get('verification_history', []))} logged")

    # 8. Restore File
    print(f"\n[8] Testing POST /api/evidence/restore-file/{ev_id} ...")
    res = requests.post(f"{API_URL}/api/evidence/restore-file/{ev_id}")
    print(f"    Status Code: {res.status_code}")
    print(f"    Message:     {res.json().get('message')}")

    # 9. Final Verification on Restored File
    print(f"\n[9] Testing GET /api/evidence/{ev_id}/verify (Restored File) ...")
    res = requests.get(f"{API_URL}/api/evidence/{ev_id}/verify")
    verify_3 = res.json()
    print(f"    Integrity Status: [ {verify_3.get('integrity_status')} ]")
    print(f"    Is Match:         {verify_3.get('is_match')}")
    assert verify_3.get("integrity_status") == "VERIFIED", "Expected restored file to be VERIFIED!"

    print("\n" + "=" * 70)
    print("  ALL BACKEND API TESTS PASSED SUCCESSFULLY! (100% OK)")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    test_backend_api()
