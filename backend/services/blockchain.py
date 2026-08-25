"""
Blockchain Service for Ethereum / Polygon EVM Smart Contract Interactions via Web3.py.

Handles:
- Web3 provider connection (Local Hardhat Node or Polygon Amoy Testnet).
- Secure registrar wallet transaction signing via environment variable.
- Gas estimation and nonce management.
- Transaction broadcast and receipt confirmation polling.
- Zero-gas view function execution (hash verification, version queries).
"""

import json
import logging
import os
import time
from typing import Any, Dict, Optional, Tuple

from web3 import Web3
from web3.exceptions import TransactionNotFound, TimeExhausted

from backend.services.hashing import hex_to_bytes32, string_to_bytes32, bytes32_to_hex

logger = logging.getLogger(__name__)

# Fallback ABI in case artifact has not been compiled yet
DEFAULT_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "initialAdmin", "type": "address"}],
        "stateMutability": "nonpayable",
        "type": "constructor",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
            {"indexed": True, "internalType": "uint256", "name": "version", "type": "uint256"},
            {"indexed": False, "internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"indexed": True, "internalType": "address", "name": "registeredBy", "type": "address"},
        ],
        "name": "EvidenceRegistered",
        "type": "event",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
            {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
        ],
        "name": "registerEvidence",
        "outputs": [{"internalType": "uint256", "name": "newVersion", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
            {"internalType": "uint256", "name": "version", "type": "uint256"},
            {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
        ],
        "name": "registerEvidenceVersion",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
            {"internalType": "uint256", "name": "version", "type": "uint256"},
        ],
        "name": "getEvidence",
        "outputs": [
            {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
            {"internalType": "uint256", "name": "registeredAt", "type": "uint256"},
            {"internalType": "address", "name": "registeredBy", "type": "address"},
            {"internalType": "bool", "name": "exists", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"}],
        "name": "getLatestEvidence",
        "outputs": [
            {"internalType": "uint256", "name": "version", "type": "uint256"},
            {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
            {"internalType": "uint256", "name": "registeredAt", "type": "uint256"},
            {"internalType": "address", "name": "registeredBy", "type": "address"},
            {"internalType": "bool", "name": "exists", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
            {"internalType": "uint256", "name": "version", "type": "uint256"},
            {"internalType": "bytes32", "name": "currentEvidenceHash", "type": "bytes32"},
        ],
        "name": "verifyEvidence",
        "outputs": [
            {"internalType": "bool", "name": "isValid", "type": "bool"},
            {"internalType": "uint256", "name": "registeredAt", "type": "uint256"},
            {"internalType": "address", "name": "registeredBy", "type": "address"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
            {"internalType": "bytes32", "name": "currentEvidenceHash", "type": "bytes32"},
        ],
        "name": "verifyLatestEvidence",
        "outputs": [
            {"internalType": "bool", "name": "isValid", "type": "bool"},
            {"internalType": "uint256", "name": "version", "type": "uint256"},
            {"internalType": "uint256", "name": "registeredAt", "type": "uint256"},
            {"internalType": "address", "name": "registeredBy", "type": "address"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"}],
        "name": "latestVersion",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


class BlockchainService:
    def __init__(self):
        self.rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
        self.network_name = os.getenv("BLOCKCHAIN_NETWORK_NAME", "Local Hardhat / Polygon Amoy")
        self.private_key = os.getenv("REGISTRAR_PRIVATE_KEY", "")
        self.contract_address = os.getenv("CONTRACT_ADDRESS", "")
        self.chain_id = int(os.getenv("CHAIN_ID", "31337"))
        self.explorer_base_url = os.getenv("EXPLORER_BASE_URL", "https://amoy.polygonscan.com")

        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.account = None
        if self.private_key:
            try:
                self.account = self.w3.eth.account.from_key(self.private_key)
            except Exception as e:
                logger.warning(f"Failed to load registrar account from private key: {e}")

        self.abi = self._load_abi()
        self.contract = None
        if self.contract_address and Web3.is_address(self.contract_address):
            self.contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(self.contract_address),
                abi=self.abi
            )

    def _load_abi(self) -> list:
        artifact_path = os.path.join(
            os.path.dirname(__file__), "..", "contract_artifacts", "EvidenceRegistry.json"
        )
        if os.path.exists(artifact_path):
            try:
                with open(artifact_path, "r") as f:
                    data = json.load(f)
                    return data.get("abi", DEFAULT_ABI)
            except Exception as e:
                logger.error(f"Error reading artifact ABI: {e}")
        return DEFAULT_ABI

    def is_connected(self) -> bool:
        try:
            return self.w3.is_connected()
        except Exception:
            return False

    def get_explorer_tx_url(self, tx_hash: str) -> str:
        if not tx_hash:
            return ""
        if "amoy" in self.network_name.lower() or "polygon" in self.network_name.lower():
            return f"{self.explorer_base_url.rstrip('/')}/tx/{tx_hash}"
        return f"http://localhost:8545/tx/{tx_hash}"

    def register_evidence(
        self, evidence_id_str: str, sha256_hex: str
    ) -> Dict[str, Any]:
        """
        Submits an on-chain transaction to register a SHA-256 evidence hash.
        Signs with registrar wallet, estimates gas, broadcasts transaction, and waits for confirmation.
        """
        if not self.is_connected():
            raise ConnectionError(f"Cannot connect to Blockchain RPC at {self.rpc_url}")
        if not self.account:
            raise ValueError("No registrar private key configured in environment.")
        if not self.contract:
            raise ValueError("Smart contract address not configured or invalid.")

        evidence_id_b32 = string_to_bytes32(evidence_id_str)
        evidence_hash_b32 = hex_to_bytes32(sha256_hex)

        sender_address = self.account.address
        nonce = self.w3.eth.get_transaction_count(sender_address, "pending")

        # Build transaction
        tx_function = self.contract.functions.registerEvidence(
            evidence_id_b32, evidence_hash_b32
        )

        try:
            gas_estimate = tx_function.estimate_gas({"from": sender_address})
            gas_limit = int(gas_estimate * 1.25)
        except Exception:
            gas_limit = 250000

        gas_price = self.w3.eth.gas_price

        tx_payload = tx_function.build_transaction({
            "from": sender_address,
            "nonce": nonce,
            "gas": gas_limit,
            "gasPrice": gas_price,
            "chainId": self.chain_id,
        })

        # Sign transaction
        signed_tx = self.w3.eth.account.sign_transaction(tx_payload, private_key=self.private_key)

        # Send raw transaction
        tx_hash_bytes = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_hash = tx_hash_bytes.hex()
        logger.info(f"Broadcasted registerEvidence tx: {tx_hash}")

        # Wait for receipt
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=120)
        if receipt["status"] != 1:
            raise RuntimeError(f"Transaction failed on-chain (status 0): {tx_hash}")

        # Parse assigned version from event or call latestVersion
        assigned_version = self.contract.functions.latestVersion(evidence_id_b32).call()

        return {
            "transaction_hash": tx_hash,
            "block_number": receipt["blockNumber"],
            "version": assigned_version,
            "gas_used": receipt["gasUsed"],
            "registered_by": sender_address,
            "contract_address": self.contract.address,
            "network": self.network_name,
        }

    def verify_on_chain(
        self, evidence_id_str: str, version: int, current_sha256_hex: str
    ) -> Tuple[bool, int, str]:
        """
        Executes zero-gas contract view call to verify if candidate hash matches the on-chain anchor.
        Returns: (is_valid, registered_at_timestamp, registered_by_address)
        """
        if not self.contract:
            raise ValueError("Smart contract address not configured.")

        evidence_id_b32 = string_to_bytes32(evidence_id_str)
        candidate_hash_b32 = hex_to_bytes32(current_sha256_hex)

        is_valid, registered_at, registered_by = self.contract.functions.verifyEvidence(
            evidence_id_b32, version, candidate_hash_b32
        ).call()

        return is_valid, registered_at, registered_by

    def get_on_chain_evidence(
        self, evidence_id_str: str, version: int
    ) -> Dict[str, Any]:
        """
        Retrieves the exact on-chain record for (evidenceId, version).
        """
        if not self.contract:
            raise ValueError("Smart contract address not configured.")

        evidence_id_b32 = string_to_bytes32(evidence_id_str)
        evidence_hash, registered_at, registered_by, exists = (
            self.contract.functions.getEvidence(evidence_id_b32, version).call()
        )

        return {
            "evidence_hash": bytes32_to_hex(evidence_hash),
            "registered_at": registered_at,
            "registered_by": registered_by,
            "exists": exists,
        }

    def get_latest_version(self, evidence_id_str: str) -> int:
        if not self.contract:
            return 0
        evidence_id_b32 = string_to_bytes32(evidence_id_str)
        return self.contract.functions.latestVersion(evidence_id_b32).call()


# Singleton instance for application-wide dependency
blockchain_service = BlockchainService()
