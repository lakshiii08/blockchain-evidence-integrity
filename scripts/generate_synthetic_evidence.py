"""
Synthetic Evidence Generator for Hackathon Demonstration & Testing.

Generates realistic mock investigative evidence files:
1. CASE-101-FIR.pdf
2. CASE-101-CDR.csv
"""

import os

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "samples")
os.makedirs(SAMPLE_DIR, exist_ok=True)


def generate_synthetic_fir():
    path = os.path.join(SAMPLE_DIR, "CASE-101-FIR.pdf")
    content = (
        b"%PDF-1.4\n"
        b"%FIRST INFORMATION REPORT (CRIME BRANCH INVESTIGATION UNIT)\n"
        b"Case Number: FIR-2026-CR-00101\n"
        b"Police Station: Central Cyber & Forensics Division\n"
        b"Date & Time of Incident: 2026-08-24 14:30:00 IST\n"
        b"Incident Type: Financial Cyber Fraud & Unauthorized Server Intrusions\n"
        b"Primary Suspect: Entity ID #9982 (Pseudonym: CipherX)\n"
        b"Investigating Officer: Inspector R. Sharma (Badge #8821)\n"
        b"Seized Digital Storage: 2x 1TB SSD Encrypted Drives, Hardware Security Key #44\n"
        b"Chain of Custody Origin: Forensic Seizure Locker A-12\n"
        b"%%EOF\n"
    )
    with open(path, "wb") as f:
        f.write(content)
    print(f"[OK] Generated synthetic FIR document: {path}")


def generate_synthetic_cdr():
    path = os.path.join(SAMPLE_DIR, "CASE-101-CDR.csv")
    content = (
        "record_id,caller_msisdn,callee_msisdn,timestamp_utc,duration_seconds,tower_cell_id,imei_hash\n"
        "CDR-001,+919876500001,+919876500002,2026-08-24T09:00:15Z,185,CELL-NORTH-881,a1b2c3d4e5f6\n"
        "CDR-002,+919876500001,+919876500099,2026-08-24T09:15:42Z,45,CELL-NORTH-881,a1b2c3d4e5f6\n"
        "CDR-003,+919876500099,+919876500045,2026-08-24T10:30:00Z,620,CELL-SOUTH-104,f9e8d7c6b5a4\n"
        "CDR-004,+919876500001,+919876500111,2026-08-24T12:45:10Z,92,CELL-CENTRAL-332,a1b2c3d4e5f6\n"
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[OK] Generated synthetic CDR record: {path}")


if __name__ == "__main__":
    generate_synthetic_fir()
    generate_synthetic_cdr()
    print("\nSynthetic investigative evidence ready in data/samples/")
