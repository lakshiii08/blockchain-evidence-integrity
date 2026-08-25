// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EvidenceRegistry
 * @dev Smart contract for anchoring digital evidence cryptographic fingerprints (SHA-256 as bytes32).
 * Implements role-based registrar authorization, immutable multi-version provenance, and zero-gas public verification.
 * 
 * NOTE: Sensitive PII (FIR text, names, CDRs) is NEVER stored on-chain. Only cryptographic anchors are retained.
 */
contract EvidenceRegistry is AccessControl {
    bytes32 public constant EVIDENCE_REGISTRAR_ROLE = keccak256("EVIDENCE_REGISTRAR_ROLE");

    struct Evidence {
        bytes32 evidenceHash; // SHA-256 or Keccak-256 fingerprint
        uint256 registeredAt; // Block timestamp of registration
        address registeredBy; // Wallet address that submitted the anchor
        bool exists;          // Existence flag to guarantee immutability
    }

    // evidenceId => version => Evidence
    mapping(bytes32 => mapping(uint256 => Evidence)) private evidences;

    // evidenceId => highest version number registered
    mapping(bytes32 => uint256) public latestVersion;

    /**
     * @dev Emitted whenever a new evidence record or version is anchored on-chain.
     */
    event EvidenceRegistered(
        bytes32 indexed evidenceId,
        uint256 indexed version,
        bytes32 evidenceHash,
        uint256 timestamp,
        address indexed registeredBy
    );

    /**
     * @param initialAdmin Address granted the admin and initial registrar roles. If address(0), msg.sender is used.
     */
    constructor(address initialAdmin) {
        address admin = initialAdmin == address(0) ? msg.sender : initialAdmin;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EVIDENCE_REGISTRAR_ROLE, admin);
    }

    /**
     * @notice Registers a new evidence item with automatic sequential versioning (v1, v2, ...).
     * @param evidenceId 32-byte identifier for the evidence (e.g. hash of Case ID + Item ID).
     * @param evidenceHash 32-byte cryptographic hash (SHA-256) of the evidence file.
     * @return newVersion The assigned version number.
     */
    function registerEvidence(
        bytes32 evidenceId,
        bytes32 evidenceHash
    ) external onlyRole(EVIDENCE_REGISTRAR_ROLE) returns (uint256 newVersion) {
        require(evidenceId != bytes32(0), "Invalid evidence ID: cannot be zero");
        require(evidenceHash != bytes32(0), "Invalid evidence hash: cannot be zero");

        newVersion = latestVersion[evidenceId] + 1;
        latestVersion[evidenceId] = newVersion;

        evidences[evidenceId][newVersion] = Evidence({
            evidenceHash: evidenceHash,
            registeredAt: block.timestamp,
            registeredBy: msg.sender,
            exists: true
        });

        emit EvidenceRegistered(
            evidenceId,
            newVersion,
            evidenceHash,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @notice Registers an explicit version of an evidence item. Prevents overwriting already registered versions.
     * @param evidenceId 32-byte identifier for the evidence.
     * @param version Specific version number to register.
     * @param evidenceHash 32-byte cryptographic hash of the evidence file.
     */
    function registerEvidenceVersion(
        bytes32 evidenceId,
        uint256 version,
        bytes32 evidenceHash
    ) external onlyRole(EVIDENCE_REGISTRAR_ROLE) {
        require(evidenceId != bytes32(0), "Invalid evidence ID: cannot be zero");
        require(evidenceHash != bytes32(0), "Invalid evidence hash: cannot be zero");
        require(version > 0, "Invalid version: must be greater than zero");
        require(!evidences[evidenceId][version].exists, "Evidence version already registered");

        evidences[evidenceId][version] = Evidence({
            evidenceHash: evidenceHash,
            registeredAt: block.timestamp,
            registeredBy: msg.sender,
            exists: true
        });

        if (version > latestVersion[evidenceId]) {
            latestVersion[evidenceId] = version;
        }

        emit EvidenceRegistered(
            evidenceId,
            version,
            evidenceHash,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @notice Retrieves stored evidence record for a specific ID and version.
     * @param evidenceId 32-byte identifier for the evidence.
     * @param version Version number to query.
     */
    function getEvidence(
        bytes32 evidenceId,
        uint256 version
    )
        external
        view
        returns (
            bytes32 evidenceHash,
            uint256 registeredAt,
            address registeredBy,
            bool exists
        )
    {
        Evidence storage ev = evidences[evidenceId][version];
        return (ev.evidenceHash, ev.registeredAt, ev.registeredBy, ev.exists);
    }

    /**
     * @notice Retrieves the latest registered evidence record for a specific ID.
     * @param evidenceId 32-byte identifier for the evidence.
     */
    function getLatestEvidence(
        bytes32 evidenceId
    )
        external
        view
        returns (
            uint256 version,
            bytes32 evidenceHash,
            uint256 registeredAt,
            address registeredBy,
            bool exists
        )
    {
        version = latestVersion[evidenceId];
        if (version == 0) {
            return (0, bytes32(0), 0, address(0), false);
        }
        Evidence storage ev = evidences[evidenceId][version];
        return (version, ev.evidenceHash, ev.registeredAt, ev.registeredBy, ev.exists);
    }

    /**
     * @notice Verifies if a given hash matches the on-chain registered hash for a specific version.
     * @dev Zero-gas public view function callable by any investigator, auditor, or court.
     * @param evidenceId 32-byte identifier for the evidence.
     * @param version Version number to verify against.
     * @param currentEvidenceHash The SHA-256 hash calculated from the current candidate file.
     * @return isValid True if candidate hash matches on-chain registered hash.
     * @return registeredAt Timestamp when the evidence was registered.
     * @return registeredBy Wallet address of the registrar.
     */
    function verifyEvidence(
        bytes32 evidenceId,
        uint256 version,
        bytes32 currentEvidenceHash
    )
        external
        view
        returns (
            bool isValid,
            uint256 registeredAt,
            address registeredBy
        )
    {
        Evidence storage ev = evidences[evidenceId][version];
        if (!ev.exists) {
            return (false, 0, address(0));
        }
        isValid = (ev.evidenceHash == currentEvidenceHash);
        return (isValid, ev.registeredAt, ev.registeredBy);
    }

    /**
     * @notice Verifies if a given hash matches the on-chain registered hash for the latest version.
     * @param evidenceId 32-byte identifier for the evidence.
     * @param currentEvidenceHash The SHA-256 hash calculated from the current candidate file.
     */
    function verifyLatestEvidence(
        bytes32 evidenceId,
        bytes32 currentEvidenceHash
    )
        external
        view
        returns (
            bool isValid,
            uint256 version,
            uint256 registeredAt,
            address registeredBy
        )
    {
        version = latestVersion[evidenceId];
        if (version == 0) {
            return (false, 0, 0, address(0));
        }
        Evidence storage ev = evidences[evidenceId][version];
        isValid = (ev.evidenceHash == currentEvidenceHash);
        return (isValid, version, ev.registeredAt, ev.registeredBy);
    }

    /**
     * @notice Checks if an evidence record exists for the given ID and version.
     */
    function evidenceExists(
        bytes32 evidenceId,
        uint256 version
    ) external view returns (bool) {
        return evidences[evidenceId][version].exists;
    }
}