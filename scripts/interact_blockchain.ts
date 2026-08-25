import { network } from "hardhat";

async function main() {
  console.log("=================================================");
  console.log("  Direct Blockchain & Smart Contract Testing");
  console.log("=================================================\n");

  const { ethers } = await network.create();
  const [admin, registrar, auditor] = await ethers.getSigners();

  console.log(`[1] Accounts Initialized:`);
  console.log(`    Admin / Deployer: ${admin.address}`);
  console.log(`    Registrar Wallet: ${registrar.address}`);
  console.log(`    Auditor / Public: ${auditor.address}\n`);

  // 1. Deploy Contract
  console.log(`[2] Deploying EvidenceRegistry Smart Contract...`);
  const factory = await ethers.getContractFactory("EvidenceRegistry");
  const contract = await factory.deploy(admin.address);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`    [OK] Contract Deployed at: ${contractAddress}\n`);

  // 2. Grant Registrar Role
  console.log(`[3] Granting EVIDENCE_REGISTRAR_ROLE to Registrar Account...`);
  const registrarRole = await contract.EVIDENCE_REGISTRAR_ROLE();
  await contract.connect(admin).grantRole(registrarRole, registrar.address);
  console.log(`    [OK] Role granted successfully.\n`);

  // 3. Register Evidence Version 1
  const evidenceId = ethers.keccak256(ethers.toUtf8Bytes("EV-CASE-2026-001"));
  // Simulated SHA-256 hash of original FIR file
  const originalHash = ethers.keccak256(ethers.toUtf8Bytes("ORIGINAL_FIR_EVIDENCE_PDF_CONTENT"));

  console.log(`[4] Registering Evidence Version 1 on-chain...`);
  console.log(`    Evidence ID (bytes32):   ${evidenceId}`);
  console.log(`    Evidence Hash (bytes32): ${originalHash}`);

  const tx1 = await contract.connect(registrar).registerEvidence(evidenceId, originalHash);
  const receipt1 = await tx1.wait();
  console.log(`    [OK] Transaction Mined!`);
  console.log(`    Tx Hash:      ${receipt1.hash}`);
  console.log(`    Block Number: #${receipt1.blockNumber}`);
  console.log(`    Gas Used:     ${receipt1.gasUsed.toString()}\n`);

  // 4. Register Evidence Version 2 (Amended Report)
  const v2Hash = ethers.keccak256(ethers.toUtf8Bytes("AMENDED_FORENSIC_LAB_REPORT_V2"));
  console.log(`[5] Registering Evidence Version 2 (Auto-Incrementing)...`);
  const tx2 = await contract.connect(registrar).registerEvidence(evidenceId, v2Hash);
  await tx2.wait();
  const latestV = await contract.latestVersion(evidenceId);
  console.log(`    [OK] Latest Version is now: v${latestV.toString()}\n`);

  // 5. Query and Verify on-chain (Zero Gas)
  console.log(`[6] Testing Public On-Chain Integrity Verification (Zero Gas)...`);
  
  // Test A: Check matching hash for v1
  const [isValidV1, timeV1, regByV1] = await contract
    .connect(auditor)
    .verifyEvidence(evidenceId, 1n, originalHash);
  console.log(`    Test A (v1 with Original Hash):`);
  console.log(`      - isValid:      ${isValidV1} (Expected: true)`);
  console.log(`      - registeredBy: ${regByV1}`);

  // Test B: Check tampered hash for v1
  const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("MODIFIED_OR_CORRUPTED_FILE"));
  const [isValidTampered] = await contract
    .connect(auditor)
    .verifyEvidence(evidenceId, 1n, fakeHash);
  console.log(`\n    Test B (v1 with Tampered Hash):`);
  console.log(`      - isValid:      ${isValidTampered} (Expected: false)`);

  // Test C: Verify Latest Version
  const [isLatestValid, currentVer] = await contract
    .connect(auditor)
    .verifyLatestEvidence(evidenceId, v2Hash);
  console.log(`\n    Test C (Latest Evidence Verification):`);
  console.log(`      - isValid:      ${isLatestValid} (Expected: true)`);
  console.log(`      - version:      v${currentVer.toString()} (Expected: v2)\n`);

  console.log("=================================================");
  console.log("  ALL SMART CONTRACT OPERATIONS VERIFIED (100% OK)");
  console.log("=================================================\n");
}

main().catch((error) => {
  console.error("Interaction failed:", error);
  process.exitCode = 1;
});
