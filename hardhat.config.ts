import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    localhost: {
      type: "http",
      chainType: "l1",
      url: process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545",
    },
    polygonAmoy: {
      type: "http",
      chainType: "l1",
      url: process.env.BLOCKCHAIN_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: process.env.REGISTRAR_PRIVATE_KEY ? [process.env.REGISTRAR_PRIVATE_KEY] : [],
    },
  },
});
