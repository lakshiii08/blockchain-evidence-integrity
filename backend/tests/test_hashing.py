"""
Unit Tests for Evidence Hashing & Cryptographic Encoding Service.
"""

import hashlib
import io
import os
import tempfile
import pytest

from backend.services.hashing import (
    calculate_sha256,
    hex_to_bytes32,
    bytes32_to_hex,
    string_to_bytes32,
)


def test_calculate_sha256_bytes_and_stream():
    content = b"Case FIR #102/2026: Confiscated forensic evidence digital dump."
    expected_hash = hashlib.sha256(content).hexdigest().lower()

    # 1. From raw bytes
    assert calculate_sha256(content) == expected_hash

    # 2. From file-like BytesIO stream
    stream = io.BytesIO(content)
    assert calculate_sha256(stream) == expected_hash


def test_calculate_sha256_large_file_streaming():
    # Create 1 MB synthetic test file
    synthetic_chunk = b"A" * 1024 * 64  # 64 KB
    expected_hasher = hashlib.sha256()

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        for _ in range(16):  # 1 MB total
            tmp.write(synthetic_chunk)
            expected_hasher.update(synthetic_chunk)
        tmp_path = tmp.name

    try:
        calculated = calculate_sha256(tmp_path, chunk_size=8192)
        assert calculated == expected_hasher.hexdigest().lower()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_hex_to_bytes32_and_roundtrip():
    original_hex = "a83f91c7b165d21a99859f8c0527376c9443be886f4a86f9f692023d8c1c4f52"
    
    # Standard hex
    b32 = hex_to_bytes32(original_hex)
    assert len(b32) == 32
    assert bytes32_to_hex(b32) == original_hex

    # With 0x prefix
    b32_prefixed = hex_to_bytes32("0x" + original_hex)
    assert b32_prefixed == b32


def test_hex_to_bytes32_invalid_length():
    with pytest.raises(ValueError):
        hex_to_bytes32("deadbeef")  # too short


def test_string_to_bytes32():
    ev_id = "EV-2026-FIR-101"
    b32 = string_to_bytes32(ev_id)
    assert len(b32) == 32
    
    # Deterministic check
    assert string_to_bytes32(ev_id) == b32

    # Different IDs produce distinct hashes
    assert string_to_bytes32("EV-2026-FIR-102") != b32
