# Security Architecture & Threat Model

**Subsystem**: Blockchain Evidence Integrity & Cryptographic Provenance Anchor  
**Compliance Standard**: Zero-PII On-Chain Storage, ISO/IEC 27037 (Digital Evidence Handling Guidelines)

---

## 1. Core Security Principle & Data Segregation

The blockchain component is **NOT** a general-purpose database and **NEVER** stores confidential investigative data.

### On-Chain vs. Off-Chain Boundary:

| Data Category | Storage Location | Encryption / Protection |
| :--- | :--- | :--- |
| **Raw Evidence Files** (FIRs, PDFs, CDRs, Media) | Off-Chain (Secure Storage / MinIO / Encrypted FS) | AES-256 at rest, TLS 1.3 in transit |
| **Personally Identifiable Information (PII)** (Names, Numbers, Locations) | Off-Chain Database (PostgreSQL) | Application-level RBAC & DB encryption |
| **Investigation Intelligence & Graph Data** | Off-Chain Knowledge Graph (Neo4j) | JWT authenticated access |
| **Cryptographic Hash (SHA-256 as `bytes32`)** | **On-Chain Smart Contract** | Immutable, Publicly Verifiable Anchor |
| **Evidence Identifier (`bytes32 evidenceId`)** | **On-Chain Smart Contract** | Keccak-256 hashed pseudonymized ID |
| **Registration Timestamp & Registrar Address** | **On-Chain Smart Contract** | EVM Block Header Consensus |

---

## 2. Threat Modeling Matrix

| Threat Scenario | Potential Impact | Mitigating Architecture & Protection |
| :--- | :--- | :--- |
| **Evidence File Tampering** | Evidence altered in storage to frame or exonerate suspects. | **SHA-256 + Smart Contract Anchor**: Any 1-bit file alteration changes the SHA-256 fingerprint, triggering instant `POTENTIAL INTEGRITY MISMATCH`. |
| **Database Corruption / Manipulation** | Rogue DB admin updates database records directly. | **Decoupled Verification**: Integrity audits query the blockchain consensus directly, bypassing compromised DB values. |
| **Unauthorized Evidence Registration** | Malicious actor injects fake evidence hash on-chain. | **Role-Based Access Control (RBAC)**: Only wallets granted `EVIDENCE_REGISTRAR_ROLE` by `DEFAULT_ADMIN_ROLE` can broadcast registration transactions. |
| **Accidental Overwrite of Evidence** | Subsequent file upload overwrites original evidence hash. | **Sequential Multi-Versioning**: Contract rejects duplicate version writes (`!evidences[id][v].exists`) and enforces append-only versioning. |
| **Private Key Exposure** | Attacker steals registrar wallet private key. | **Environment Variable Isolation**: Private keys are injected exclusively via runtime environment (`REGISTRAR_PRIVATE_KEY`), never checked into git. |
| **Public Blockchain PII Leakage** | Suspect identities or FIR contents exposed publicly on blockchain explorers. | **Zero-PII Guarantee**: Only 32-byte cryptographic hashes and numeric timestamps are broadcasted. |
| **API Denial-of-Service / Memory Exhaustion** | Attacker uploads 10GB file to exhaust server RAM. | **Streaming Chunk Processing**: Hasher processes files in 8 KB streaming chunks without full memory loading. |

---

## 3. Cryptographic Specification

1. **Hash Algorithm**: SHA-256 (FIPS PUB 180-4) computed over raw file byte stream.
2. **Solidity Storage Format**: `bytes32` (fixed 32 bytes) rather than dynamic string (`string`), maximizing gas efficiency and preventing storage fragmentation.
3. **Identifier Normalization**:
   $$\text{evidenceId}_{32} = \text{keccak256}(\text{evidence\_id\_string})$$
   $$\text{evidenceHash}_{32} = \text{bytes.fromhex}(\text{sha256\_hex})$$

---

## 4. Key Management & Wallet Lifecycle

* **Dedicated Registrar Account**: Registration transactions are signed by a dedicated service wallet with scoped permissions (`EVIDENCE_REGISTRAR_ROLE`), separated from user or developer wallets.
* **Cold Admin Key**: The contract deployer / `DEFAULT_ADMIN_ROLE` can be a multi-signature wallet (Gnosis Safe) or cold key, enabling runtime granting and revoking of operational registrar wallets without contract redeployment.

---

## 5. Formal System Limitations & Explainability

> [!IMPORTANT]
> **What the Blockchain Proves**:
> * A specific digital file producing SHA-256 hash $H$ existed at block timestamp $T$ and was registered by authorized registrar wallet $W$.
> * Whether the candidate file presented in court today is bit-for-bit identical to the file registered at timestamp $T$.
>
> **What the Blockchain Does NOT Prove**:
> * Blockchain anchoring does **NOT** certify that the underlying document is factually true or truthful. (It proves **authenticity and integrity of the digital artifact**, not the veracity of the statements within the document).
