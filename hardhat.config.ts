import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-verify";
import { config as dotenvConfig } from 'dotenv';
import testWallets from './test-wallets';

dotenvConfig();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122';
const ROLLUX_RPC = 'https://rpc.rollux.com';

const config: HardhatUserConfig = {
  zksolc: {
    version: "1.3.13",
    settings: {
      optimizer: {
        enabled: true,
        mode: '3',
      },
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.27',
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
      {
        version: '0.7.5',
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: 570,
      accounts: testWallets.accounts.map((account) => ({
        privateKey: account.secretKey,
        balance: account.balance,
      })),
    },
    rollux: {
      chainId: 570,
      url: ROLLUX_RPC,
      accounts: [PRIVATE_KEY],
      gasPrice: 'auto',
    },
    sepolia: {
      url: "https://1rpc.io/sepolia"
    },
    zkSyncTestnet: {
      url: 'https://sepolia.era.zksync.dev',
      ethNetwork: 'sepolia',
      zksync: true,
      verifyURL: 'https://explorer.sepolia.era.zksync.dev/contract_verification',
      accounts: [PRIVATE_KEY],
    },
    coverage: {
      url: 'http://localhost:8555',
      chainId: 1337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 570,
      accounts: [PRIVATE_KEY],
      forking: {
        url: ROLLUX_RPC,
        enabled: true,
      },
    },
  },
  defaultNetwork: "zkSyncTestnet",
  etherscan: {
    apiKey: 'abc',
    customChains: [
      {
        network: 'rollux',
        chainId: 570,
        urls: {
          apiURL: 'https://explorer1.rollux.com/api',
          browserURL: 'https://explorer1.rollux.com/',
        },
      },
    ],
  },
  mocha: {
    timeout: 0,
  },
};

export default config;