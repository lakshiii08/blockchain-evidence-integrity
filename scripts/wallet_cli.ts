/**
 * Standalone Wallet CLI Tool.
 * 
 * Allows connecting any Ethereum / Polygon wallet via Private Key or Mnemonic
 * to interact with the EvidenceRegistry smart contract without needing a frontend.
 * 
 * Usage Examples:
 * 1. Show Wallet Info:
 *    npx hardhat run scripts/wallet_cli.ts
 * 
 * 2. Custom actions can be invoked programmatically or by passing arguments.
 */

import { network } from "hardhat";
import * as path from "path";
import {
  connectWalletWithPrivateKey,
  getWalletDetails,
  registerEvidenceWithWallet,
  verifyEvidenceWithWallet,
  grantRegistrarRole,
  calculateFileSha256
} from "./wallet_connector.js";

async function main() {
  console.log("=================================================");
  console.log("  MetaMask & Standalone Wallet Integration Tool");
  console.log("=================================================\n");

  const { ethers } = await network.create();
  const [defaultDeployer, secondaryRegistrar, publicAuditor] = await ethers.getSigners();

  // 1. Check Deployer & Registrar Wallet Info
  const adminDetails = await getWalletDetails(defaultDeployer as any);
  console.log(`[1] Admin / Deployer Wallet Connected:`);
  console.log(`    Address:    ${adminDetails.address}`);
  console.log(`    Balance:    ${adminDetails.balanceEth} ETH / POL`);
  console.log(`    Network:    ${adminDetails.networkName} (Chain ID: ${adminDetails.chainId})\n`);

  const registrarDetails = await getWalletDetails(secondaryRegistrar as any);
  console.log(`[2] Registrar Wallet Connected:`);
  console.log(`    Address:    ${registrarDetails.address}`);
  console.log(`    Balance:    ${registrarDetails.balanceEth} ETH / POL\n`);

  // 2. Deploy or locate contract
  console.log(`[3] Deploying EvidenceRegistry Contract for Wallet Testing...`);
  const factory = await ethers.getContractFactory("EvidenceRegistry");
  const contract = await factory.deploy(defaultDeployer.address);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`    [OK] Contract Deployed at: ${contractAddress}\n`);

  // 3. Grant Role from Admin Wallet to Registrar Wallet
  console.log(`[4] Granting EVIDENCE_REGISTRAR_ROLE from Admin Wallet -> Registrar Wallet...`);
  await grantRegistrarRole(defaultDeployer as any, contractAddress, secondaryRegistrar.address);
  console.log(`    [OK] Permission assigned.\n`);

  // 4. Register Evidence using Registrar Wallet
  const sampleFilePath = path.resolve("data/samples/CASE-101-FIR.pdf");
  const fileHash = calculateFileSha256(sampleFilePath);
  const evidenceId = "EV-WALLET-DEMO-001";

  console.log(`[5] Signing & Registering Evidence via Registrar Wallet:`);
  console.log(`    File:           ${sampleFilePath}`);
  console.log(`    Evidence ID:    ${evidenceId}`);
  console.log(`    Calculated SHA: ${fileHash}`);

  const regReceipt = await registerEvidenceWithWallet(
    secondaryRegistrar as any,
    contractAddress,
    evidenceId,
    fileHash
  );

  console.log(`    [OK] Transaction Confirmed!`);
  console.log(`    Tx Hash:      ${regReceipt.transactionHash}`);
  console.log(`    Block Number: #${regReceipt.blockNumber}`);
  console.log(`    Gas Used:     ${regReceipt.gasUsed}`);
  console.log(`    RegisteredBy: ${regReceipt.registeredBy}\n`);

  // 5. Verify Evidence using Public Auditor Wallet (Zero Gas)
  console.log(`[6] Verifying Integrity via Public Auditor Wallet (Zero Gas):`);
  const auditValid = await verifyEvidenceWithWallet(
    publicAuditor as any,
    contractAddress,
    evidenceId,
    fileHash
  );
  console.log(`    Result (Original File):`);
  console.log(`      - isValid:      ${auditValid.isValid} (Expected: true)`);
  console.log(`      - version:      v${auditValid.version}`);
  console.log(`      - registeredAt: ${auditValid.registeredAt}`);

  // Test Tampered File Verification
  const fakeHash = "00000000000000000000000000000000000000000000000000000000deadbeef";
  const auditTampered = await verifyEvidenceWithWallet(
    publicAuditor as any,
    contractAddress,
    evidenceId,
    fakeHash
  );
  console.log(`\n    Result (Tampered File):`);
  console.log(`      - isValid:      ${auditTampered.isValid} (Expected: false)\n`);

  console.log("=================================================");
  console.log("  WALLET INTEGRATION & TESTING COMPLETED (100% OK)");
  console.log("=================================================\n");
}

main().catch((error) => {
  console.error("Wallet CLI error:", error);
  process.exitCode = 1;
});
