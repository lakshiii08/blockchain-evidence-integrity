import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("EvidenceRegistry Smart Contract Tests", function () {
  let evidenceRegistry: any;
  let admin: any;
  let registrar: any;
  let unauthorizedUser: any;

  // Sample test data (SHA-256 hashes converted to bytes32 format)
  const sampleEvidenceId = ethers.keccak256(ethers.toUtf8Bytes("EV-CASE-2026-001"));
  const sampleEvidenceId2 = ethers.keccak256(ethers.toUtf8Bytes("EV-CASE-2026-002"));
  
  // Real SHA-256 hash example: 0xa83f91c7... (32 bytes)
  const originalHash = ethers.keccak256(ethers.toUtf8Bytes("FIR_DOCUMENT_ORIGINAL_CONTENT_V1"));
  const updatedHash = ethers.keccak256(ethers.toUtf8Bytes("FIR_DOCUMENT_AMENDED_CONTENT_V2"));
  const tamperedHash = ethers.keccak256(ethers.toUtf8Bytes("TAMPERED_OR_CORRUPTED_DOCUMENT"));

  beforeEach(async function () {
    [admin, registrar, unauthorizedUser] = await ethers.getSigners();

    // Deploy contract with admin address
    const EvidenceRegistryFactory = await ethers.getContractFactory("EvidenceRegistry");
    evidenceRegistry = await EvidenceRegistryFactory.deploy(admin.address);
    await evidenceRegistry.waitForDeployment();

    // Grant registrar role to the registrar account
    const registrarRole = await evidenceRegistry.EVIDENCE_REGISTRAR_ROLE();
    await evidenceRegistry.grantRole(registrarRole, registrar.address);
  });

  describe("Deployment & Access Control", function () {
    it("Should grant DEFAULT_ADMIN_ROLE and EVIDENCE_REGISTRAR_ROLE to admin", async function () {
      const adminRole = await evidenceRegistry.DEFAULT_ADMIN_ROLE();
      const registrarRole = await evidenceRegistry.EVIDENCE_REGISTRAR_ROLE();

      expect(await evidenceRegistry.hasRole(adminRole, admin.address)).to.be.true;
      expect(await evidenceRegistry.hasRole(registrarRole, admin.address)).to.be.true;
      expect(await evidenceRegistry.hasRole(registrarRole, registrar.address)).to.be.true;
      expect(await evidenceRegistry.hasRole(registrarRole, unauthorizedUser.address)).to.be.false;
    });

    it("Should reject evidence registration from unauthorized callers", async function () {
      await expect(
        evidenceRegistry.connect(unauthorizedUser).registerEvidence(sampleEvidenceId, originalHash)
      ).to.be.revertedWithCustomError(evidenceRegistry, "AccessControlUnauthorizedAccount");
    });

    it("Should allow admin to revoke and grant registrar roles dynamically", async function () {
      const registrarRole = await evidenceRegistry.EVIDENCE_REGISTRAR_ROLE();
      
      await evidenceRegistry.revokeRole(registrarRole, registrar.address);
      expect(await evidenceRegistry.hasRole(registrarRole, registrar.address)).to.be.false;

      await expect(
        evidenceRegistry.connect(registrar).registerEvidence(sampleEvidenceId, originalHash)
      ).to.be.revertedWithCustomError(evidenceRegistry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Evidence Registration & Sequential Versioning", function () {
    it("Should register version 1 and emit EvidenceRegistered event", async function () {
      const tx = await evidenceRegistry.connect(registrar).registerEvidence(sampleEvidenceId, originalHash);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      expect(await evidenceRegistry.latestVersion(sampleEvidenceId)).to.equal(1n);

      const [evidenceHash, registeredAt, registeredBy, exists] = await evidenceRegistry.getEvidence(
        sampleEvidenceId,
        1n
      );

      expect(evidenceHash).to.equal(originalHash);
      expect(registeredBy).to.equal(registrar.address);
      expect(registeredAt).to.equal(BigInt(block.timestamp));
      expect(exists).to.be.true;
    });

    it("Should automatically increment versions sequentially (v1 -> v2 -> v3)", async function () {
      // Register v1
      await evidenceRegistry.connect(registrar).registerEvidence(sampleEvidenceId, originalHash);
      expect(await evidenceRegistry.latestVersion(sampleEvidenceId)).to.equal(1n);

      // Register v2
      await evidenceRegistry.connect(registrar).registerEvidence(sampleEvidenceId, updatedHash);
      expect(await evidenceRegistry.latestVersion(sampleEvidenceId)).to.equal(2n);

      // Register v3
      const v3Hash = ethers.keccak256(ethers.toUtf8Bytes("FORENSIC_FINAL_REPORT_V3"));
      await evidenceRegistry.connect(registrar).registerEvidence(sampleEvidenceId, v3Hash);
      expect(await evidenceRegistry.latestVersion(sampleEvidenceId)).to.equal(3n);

      // Verify each version maintains its own distinct immutable hash
      const [hashV1] = await evidenceRegistry.getEvidence(sampleEvidenceId, 1n);
      const [hashV2] = await evidenceRegistry.getEvidence(sampleEvidenceId, 2n);
      const [hashV3] = await evidenceRegistry.getEvidence(sampleEvidenceId, 3n);

      expect(hashV1).to.equal(originalHash);
      expect(hashV2).to.equal(updatedHash);
      expect(hashV3).to.equal(v3Hash);
    });

    it("Should reject zero evidence ID or zero evidence hash", async function () {
      const zeroBytes = ethers.ZeroHash;

      await expect(
        evidenceRegistry.connect(registrar).registerEvidence(zeroBytes, originalHash)
      ).to.be.revertedWith("Invalid evidence ID: cannot be zero");

      await expect(
        evidenceRegistry.connect(registrar).registerEvidence(sampleEvidenceId, zeroBytes)
      ).to.be.revertedWith("Invalid evidence hash: cannot be zero");
    });
  });

  describe("Explicit Version Registration & Duplicate Prevention", function () {
    it("Should prevent duplicate registration of the same version", async function () {
      await evidenceRegistry.connect(registrar).registerEvidenceVersion(sampleEvidenceId, 1n, originalHash);

      await expect(
        evidenceRegistry.connect(registrar).registerEvidenceVersion(sampleEvidenceId, 1n, updatedHash)
      ).to.be.revertedWith("Evidence version already registered");
    });

    it("Should reject version 0 in explicit registration", async function () {
      await expect(
        evidenceRegistry.connect(registrar).registerEvidenceVersion(sampleEvidenceId, 0n, originalHash)
      ).to.be.revertedWith("Invalid version: must be greater than zero");
    });
  });

  describe("Public Zero-Gas Integrity Verification", function () {
    beforeEach(async function () {
      await evidenceRegistry.connect(registrar).registerEvidence(sampleEvidenceId, originalHash);
      await evidenceRegistry.connect(registrar).registerEvidence(sampleEvidenceId, updatedHash);
    });

    it("Should return isValid = true when supplied hash matches registered hash", async function () {
      const [isValidV1, registeredAtV1, registeredByV1] = await evidenceRegistry
        .connect(unauthorizedUser)
        .verifyEvidence(sampleEvidenceId, 1n, originalHash);

      expect(isValidV1).to.be.true;
      expect(registeredByV1).to.equal(registrar.address);
      expect(registeredAtV1).to.be.gt(0n);

      const [isValidV2] = await evidenceRegistry
        .connect(unauthorizedUser)
        .verifyEvidence(sampleEvidenceId, 2n, updatedHash);

      expect(isValidV2).to.be.true;
    });

    it("Should return isValid = false when supplied hash does not match registered hash", async function () {
      const [isValid] = await evidenceRegistry
        .connect(unauthorizedUser)
        .verifyEvidence(sampleEvidenceId, 1n, tamperedHash);

      expect(isValid).to.be.false;
    });

    it("Should return isValid = false for non-existent evidence or versions", async function () {
      const [isValid] = await evidenceRegistry
        .connect(unauthorizedUser)
        .verifyEvidence(sampleEvidenceId, 99n, originalHash);

      expect(isValid).to.be.false;

      const [isValidUnregistered] = await evidenceRegistry
        .connect(unauthorizedUser)
        .verifyEvidence(sampleEvidenceId2, 1n, originalHash);

      expect(isValidUnregistered).to.be.false;
    });

    it("Should verify latest evidence version accurately", async function () {
      const [isValid, version] = await evidenceRegistry
        .connect(unauthorizedUser)
        .verifyLatestEvidence(sampleEvidenceId, updatedHash);

      expect(isValid).to.be.true;
      expect(version).to.equal(2n);

      const [isTampered] = await evidenceRegistry
        .connect(unauthorizedUser)
        .verifyLatestEvidence(sampleEvidenceId, tamperedHash);

      expect(isTampered).to.be.false;
    });

    it("Should provide correct evidenceExists status", async function () {
      expect(await evidenceRegistry.evidenceExists(sampleEvidenceId, 1n)).to.be.true;
      expect(await evidenceRegistry.evidenceExists(sampleEvidenceId, 2n)).to.be.true;
      expect(await evidenceRegistry.evidenceExists(sampleEvidenceId, 3n)).to.be.false;
      expect(await evidenceRegistry.evidenceExists(sampleEvidenceId2, 1n)).to.be.false;
    });
  });
});
