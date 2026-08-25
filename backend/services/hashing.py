"""
Secure Hashing Service for Digital Evidence Integrity.

Features:
- Stream-based SHA-256 calculation (8 KB chunks) for memory-safe handling of large files (PDFs, CDRs, video/audio).
- Bidirectional converter between standard lowercase hexadecimal SHA-256 strings and EVM bytes32 format.
- Deterministic bytes32 identifier generation for textual evidence IDs (e.g. 'EV-101' -> bytes32).
"""

import hashlib
import os
from typing import BinaryIO, Union
from eth_utils import keccak


CHUNK_SIZE = 8192  # 8 KB streaming chunk size


def calculate_sha256(file_input: Union[str, bytes, BinaryIO], chunk_size: int = CHUNK_SIZE) -> str:
    """
    Computes the SHA-256 checksum of a file path, raw bytes, or file-like binary stream.
    Streams in chunks to avoid loading large files into memory.

    :param file_input: File path (str), raw bytes (bytes), or file-like object (BinaryIO)
    :param chunk_size: Buffer size in bytes (default: 8192 bytes)
    :return: 64-character lowercase hexadecimal SHA-256 string
    """
    hasher = hashlib.sha256()

    if isinstance(file_input, bytes):
        hasher.update(file_input)
        return hasher.hexdigest().lower()

    if isinstance(file_input, str):
        if not os.path.isfile(file_input):
            raise FileNotFoundError(f"Evidence file not found: {file_input}")
        with open(file_input, "rb") as f:
            while chunk := f.read(chunk_size):
                hasher.update(chunk)
        return hasher.hexdigest().lower()

    # If it's a file-like object (e.g. FastAPI UploadFile.file or BytesIO)
    original_position = None
    if hasattr(file_input, "tell") and hasattr(file_input, "seek"):
        try:
            original_position = file_input.tell()
            file_input.seek(0)
        except Exception:
            pass

    while chunk := file_input.read(chunk_size):
        hasher.update(chunk)

    if original_position is not None and hasattr(file_input, "seek"):
        file_input.seek(original_position)

    return hasher.hexdigest().lower()


def hex_to_bytes32(hex_str: str) -> bytes:
    """
    Converts a 64-character hex string (with or without '0x' prefix) to 32 raw bytes.
    Used when passing SHA-256 hashes to Solidity contracts expecting `bytes32`.
    """
    clean_hex = hex_str.strip()
    if clean_hex.startswith("0x") or clean_hex.startswith("0X"):
        clean_hex = clean_hex[2:]

    if len(clean_hex) != 64:
        raise ValueError(f"Invalid SHA-256 hex string length: expected 64 hex chars, got {len(clean_hex)}")

    return bytes.fromhex(clean_hex)


def bytes32_to_hex(b: Union[bytes, str]) -> str:
    """
    Converts 32 raw bytes (or a hex string returned by Web3) to a standard 64-character lowercase hex string without '0x'.
    """
    if isinstance(b, str):
        clean = b.strip()
        if clean.startswith("0x") or clean.startswith("0X"):
            clean = clean[2:]
        return clean.lower().zfill(64)
    elif isinstance(b, bytes):
        return b.hex().lower().zfill(64)
    raise TypeError(f"Expected bytes or str, got {type(b)}")


def string_to_bytes32(text: str) -> bytes:
    """
    Converts a textual evidence or case ID (e.g. 'EV-CASE-2026-001') into a deterministic 32-byte hash.
    Uses Keccak-256 to ensure collisions are mathematically infeasible and fit in Solidity `bytes32`.
    """
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Evidence ID text cannot be empty")
    return keccak(text=clean_text)
