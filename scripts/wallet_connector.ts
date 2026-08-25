/**
 * Wallet Connection & Smart Contract Integration Module (Ethers.js v6).
 *
 * Provides clean wallet connection abstractions for:
 * - Connecting via Private Key
 * - Connecting via Mnemonic Phrase (BIP-39)
 * - Connecting via Read-Only RPC Provider (Zero-gas verifiers)
 * - Registering digital evidence on-chain
 * - Verifying evidence integrity on-chain
 * - Granting/revoking registrar permissions with an admin wallet
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as crypto from "crypto";

// Minimal ABI for direct contract interaction
export const EVIDENCE_REGISTRY_ABI = [
  "function registerEvidence(bytes32 evidenceId, bytes32 evidenceHash) external returns (uint256)",
  "function registerEvidenceVersion(bytes32 evidenceId, uint256 version, bytes32 evidenceHash) external",
  "function getEvidence(bytes32 evidenceId, uint256 version) external view returns (bytes32 evidenceHash, uint256 registeredAt, address registeredBy, bool exists)",
  "function getLatestEvidence(bytes32 evidenceId) external view returns (uint256 version, bytes32 evidenceHash, uint256 registeredAt, address registeredBy, bool exists)",
  "function verifyEvidence(bytes32 evidenceId, uint256 version, bytes32 currentEvidenceHash) external view returns (bool isValid, uint256 registeredAt, address registeredBy)",
  "function verifyLatestEvidence(bytes32 evidenceId, bytes32 currentEvidenceHash) external view returns (bool isValid, uint256 version, uint256 registeredAt, address registeredBy)",
  "function latestVersion(bytes32 evidenceId) external view returns (uint256)",
  "function evidenceExists(bytes32 evidenceId, uint256 version) external view returns (bool)",
  "function grantRole(bytes32 role, address account) external",
  "function revokeRole(bytes32 role, address account) external",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function EVIDENCE_REGISTRAR_ROLE() external view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() external view returns (bytes32)",
  "event EvidenceRegistered(bytes32 indexed evidenceId, uint256 indexed version, bytes32 evidenceHash, uint256 timestamp, address indexed registeredBy)"
];

/**
 * Computes the SHA-256 hash of a file at a given path.
 */
export function calculateFileSha256(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Evidence file not found: ${filePath}`);
  }
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex").toLowerCase();
}

/**
 * Converts a textual evidence ID (e.g. "EV-101") to bytes32 format using keccak256.
 */
export function formatEvidenceIdToBytes32(evidenceId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(evidenceId.trim()));
}

/**
 * Formats a SHA-256 hex string into bytes32 format (with '0x' prefix).
 */
export function formatSha256ToBytes32(sha256Hex: string): string {
  const clean = sha256Hex.replace(/^0x/i, "").trim();
  if (clean.length !== 64) {
    throw new Error(`Invalid SHA-256 length: expected 64 hex chars, got ${clean.length}`);
  }
  return "0x" + clean;
}

/**
 * Creates an RPC provider for read-only / zero-gas verification.
 */
export function getProvider(rpcUrl: string = "http://127.0.0.1:8545"): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Connects a wallet using a raw private key.
 */
export function connectWalletWithPrivateKey(
  privateKey: string,
  rpcUrl: string = "http://127.0.0.1:8545"
): ethers.Wallet {
  const provider = getProvider(rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Connects a wallet using a 12/24-word BIP-39 mnemonic seed phrase.
 */
export function connectWalletWithMnemonic(
  mnemonic: string,
  rpcUrl: string = "http://127.0.0.1:8545"
): ethers.HDNodeWallet {
  const provider = getProvider(rpcUrl);
  return ethers.Wallet.fromPhrase(mnemonic, provider);
}

/**
 * Retrieves wallet metadata (address, network, ETH/POL balance, transaction count).
 */
export async function getWalletDetails(wallet: ethers.Wallet | ethers.HDNodeWallet) {
  const address = await wallet.getAddress();
  const provider = wallet.provider!;
  const [balance, network, nonce] = await Promise.all([
    provider.getBalance(address),
    provider.getNetwork(),
    provider.getTransactionCount(address)
  ]);

  return {
    address,
    networkName: network.name,
    chainId: network.chainId.toString(),
    balanceEth: ethers.formatEther(balance),
    nonce
  };
}

/**
 * Registers an evidence file hash on-chain using the connected wallet.
 */
export async function registerEvidenceWithWallet(
  wallet: ethers.Wallet | ethers.HDNodeWallet,
  contractAddress: string,
  evidenceId: string,
  sha256Hex: string
) {
  const contract = new ethers.Contract(contractAddress, EVIDENCE_REGISTRY_ABI, wallet);
  const evidenceIdBytes32 = formatEvidenceIdToBytes32(evidenceId);
  const evidenceHashBytes32 = formatSha256ToBytes32(sha256Hex);

  console.log(`[Wallet Connector] Broadcasting registerEvidence tx from ${wallet.address}...`);
  const tx = await contract.registerEvidence(evidenceIdBytes32, evidenceHashBytes32);
  console.log(`[Wallet Connector] Transaction Hash: ${tx.hash}`);

  const receipt = await tx.wait();
  const latestVersion = await contract.latestVersion(evidenceIdBytes32);

  return {
    success: receipt.status === 1,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    assignedVersion: Number(latestVersion),
    registeredBy: wallet.address
  };
}

/**
 * Performs a zero-gas verification on-chain using any wallet or read-only provider.
 */
export async function verifyEvidenceWithWallet(
  providerOrWallet: ethers.Provider | ethers.Wallet | ethers.HDNodeWallet,
  contractAddress: string,
  evidenceId: string,
  sha256Hex: string,
  version?: number
) {
  const contract = new ethers.Contract(contractAddress, EVIDENCE_REGISTRY_ABI, providerOrWallet);
  const evidenceIdBytes32 = formatEvidenceIdToBytes32(evidenceId);
  const candidateHashBytes32 = formatSha256ToBytes32(sha256Hex);

  if (version && version > 0) {
    const [isValid, registeredAt, registeredBy] = await contract.verifyEvidence(
      evidenceIdBytes32,
      BigInt(version),
      candidateHashBytes32
    );
    return {
      isValid,
      version,
      registeredAt: Number(registeredAt) > 0 ? new Date(Number(registeredAt) * 1000).toISOString() : null,
      registeredBy
    };
  } else {
    const [isValid, latestV, registeredAt, registeredBy] = await contract.verifyLatestEvidence(
      evidenceIdBytes32,
      candidateHashBytes32
    );
    return {
      isValid,
      version: Number(latestV),
      registeredAt: Number(registeredAt) > 0 ? new Date(Number(registeredAt) * 1000).toISOString() : null,
      registeredBy
    };
  }
}

/**
 * Grants EVIDENCE_REGISTRAR_ROLE to a target address using an admin wallet.
 */
export async function grantRegistrarRole(
  adminWallet: ethers.Wallet | ethers.HDNodeWallet,
  contractAddress: string,
  targetAddress: string
) {
  const contract = new ethers.Contract(contractAddress, EVIDENCE_REGISTRY_ABI, adminWallet);
  const registrarRole = await contract.EVIDENCE_REGISTRAR_ROLE();

  console.log(`[Admin Wallet] Granting registrar role to ${targetAddress}...`);
  const tx = await contract.grantRole(registrarRole, targetAddress);
  const receipt = await tx.wait();

  return {
    success: receipt.status === 1,
    transactionHash: receipt.hash,
    targetAddress,
    grantedBy: adminWallet.address
  };
}
