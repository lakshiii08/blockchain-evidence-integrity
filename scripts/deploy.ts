import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("=================================================");
  console.log("  EvidenceRegistry Smart Contract Deployment");
  console.log("=================================================\n");

  const { ethers } = await network.create();
  const [deployer] = await ethers.getSigners();

  console.log(`Deploying using account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH / POL\n`);

  // Deploy EvidenceRegistry
  const EvidenceRegistryFactory = await ethers.getContractFactory("EvidenceRegistry");
  const evidenceRegistry = await EvidenceRegistryFactory.deploy(deployer.address);
  await evidenceRegistry.waitForDeployment();

  const contractAddress = await evidenceRegistry.getAddress();
  console.log(`✓ EvidenceRegistry deployed successfully!`);
  console.log(`  Contract Address: ${contractAddress}`);
  console.log(`  Admin / Initial Registrar: ${deployer.address}\n`);

  // Export artifact with address & ABI for backend and frontend
  const artifactPath = path.resolve(
    __dirname,
    "../artifacts/contracts/EvidenceRegistry.sol/EvidenceRegistry.json"
  );

  let abi = [];
  if (fs.existsSync(artifactPath)) {
    const rawArtifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    abi = rawArtifact.abi;
  }

  const exportPayload = {
    contractName: "EvidenceRegistry",
    address: contractAddress,
    network: network.name || "localhost",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    abi: abi,
  };

  // 1. Export to backend/contract_artifacts/
  const backendArtifactDir = path.resolve(__dirname, "../backend/contract_artifacts");
  fs.mkdirSync(backendArtifactDir, { recursive: true });
  fs.writeFileSync(
    path.join(backendArtifactDir, "EvidenceRegistry.json"),
    JSON.stringify(exportPayload, null, 2)
  );
  console.log(`✓ Exported ABI & address to backend/contract_artifacts/EvidenceRegistry.json`);

  // 2. Export to frontend/src/contract_artifacts/
  const frontendArtifactDir = path.resolve(__dirname, "../frontend/src/contract_artifacts");
  fs.mkdirSync(frontendArtifactDir, { recursive: true });
  fs.writeFileSync(
    path.join(frontendArtifactDir, "EvidenceRegistry.json"),
    JSON.stringify(exportPayload, null, 2)
  );
  console.log(`✓ Exported ABI & address to frontend/src/contract_artifacts/EvidenceRegistry.json\n`);

  console.log("=================================================");
  console.log("  To interact via Backend or Frontend, configure:");
  console.log(`  CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`  REGISTRAR_PRIVATE_KEY=<deployer_private_key>`);
  console.log("=================================================\n");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
