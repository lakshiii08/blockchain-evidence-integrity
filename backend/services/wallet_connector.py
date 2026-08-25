"""
Python Web3 Wallet Connector Module.

Supports:
- Loading wallets from raw Private Keys or Encrypted JSON Keystores
- Fetching wallet address, ETH/POL balance, and transaction count
- Signing and sending evidence registration transactions directly via wallet
- Zero-gas on-chain verification
"""

import json
import logging
from typing import Any, Dict, Optional, Tuple
from web3 import Web3
from eth_account import Account

from backend.services.hashing import hex_to_bytes32, string_to_bytes32, bytes32_to_hex

logger = logging.getLogger(__name__)


class Web3WalletConnector:
    def __init__(self, rpc_url: str = "http://127.0.0.1:8545"):
        self.rpc_url = rpc_url
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))

    def is_connected(self) -> bool:
        try:
            return self.w3.is_connected()
        except Exception:
            return False

    def load_wallet_from_private_key(self, private_key: str):
        """Loads a LocalAccount from raw private key."""
        clean_key = private_key.strip()
        if not clean_key.startswith("0x"):
            clean_key = "0x" + clean_key
        return Account.from_key(clean_key)

    def load_wallet_from_keystore(self, keystore_path: str, password: str):
        """Decrypts a standard Ethereum JSON keystore file."""
        with open(keystore_path, "r") as f:
            keystore_json = json.load(f)
        private_key = Account.decrypt(keystore_json, password)
        return Account.from_key(private_key)

    def get_wallet_info(self, address_or_account) -> Dict[str, Any]:
        """Returns address, POL/ETH balance, and nonce for a wallet."""
        address = (
            address_or_account.address
            if hasattr(address_or_account, "address")
            else Web3.to_checksum_address(address_or_account)
        )
        balance_wei = self.w3.eth.get_balance(address)
        nonce = self.w3.eth.get_transaction_count(address, "pending")
        chain_id = self.w3.eth.chain_id

        return {
            "address": address,
            "balance_eth": float(self.w3.from_wei(balance_wei, "ether")),
            "nonce": nonce,
            "chain_id": chain_id,
            "network": "Polygon Amoy" if chain_id == 80002 else f"EVM Chain ({chain_id})"
        }

    def register_evidence_with_wallet(
        self,
        account,
        contract_address: str,
        contract_abi: list,
        evidence_id_str: str,
        sha256_hex: str
    ) -> Dict[str, Any]:
        """Signs and broadcasts a registerEvidence transaction using a specified wallet account."""
        contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=contract_abi
        )
        evidence_id_b32 = string_to_bytes32(evidence_id_str)
        evidence_hash_b32 = hex_to_bytes32(sha256_hex)

        nonce = self.w3.eth.get_transaction_count(account.address, "pending")
        gas_price = self.w3.eth.gas_price

        tx_function = contract.functions.registerEvidence(evidence_id_b32, evidence_hash_b32)
        try:
            gas_limit = int(tx_function.estimate_gas({"from": account.address}) * 1.25)
        except Exception:
            gas_limit = 250000

        tx_payload = tx_function.build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": gas_limit,
            "gasPrice": gas_price,
            "chainId": self.w3.eth.chain_id,
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx_payload, private_key=account.key)
        tx_hash_bytes = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_hash = tx_hash_bytes.hex()

        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=120)
        assigned_version = contract.functions.latestVersion(evidence_id_b32).call()

        return {
            "success": receipt["status"] == 1,
            "transaction_hash": tx_hash,
            "block_number": receipt["blockNumber"],
            "gas_used": receipt["gasUsed"],
            "version": assigned_version,
            "registered_by": account.address
        }
