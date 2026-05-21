import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? '0x' + '0'.repeat(64);
const KITE_RPC_URL = process.env.KITE_RPC_URL ?? 'https://rpc-testnet.gokite.ai';
const KITE_RPC_URL_MAINNET = process.env.KITE_RPC_URL_MAINNET ?? 'https://rpc.gokite.ai';
const ETH_SEPOLIA_RPC_URL = process.env.ETH_SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    kiteTestnet: {
      url: KITE_RPC_URL,
      chainId: 2368,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    kiteMainnet: {
      url: KITE_RPC_URL_MAINNET,
      chainId: 2366,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    ethSepolia: {
      url: ETH_SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    baseSepolia: {
      url: BASE_SEPOLIA_RPC_URL,
      chainId: 84532,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      kiteTestnet: 'no-api-key-needed',
      kiteMainnet: 'no-api-key-needed',
      ethSepolia: process.env.ETHERSCAN_API_KEY ?? '',
      baseSepolia: process.env.BASESCAN_API_KEY ?? '',
    },
    customChains: [
      {
        network: 'kiteTestnet',
        chainId: 2368,
        urls: {
          apiURL: 'https://testnet.kitescan.ai/api',
          browserURL: 'https://testnet.kitescan.ai',
        },
      },
      {
        network: 'kiteMainnet',
        chainId: 2366,
        urls: {
          apiURL: 'https://kitescan.ai/api',
          browserURL: 'https://kitescan.ai',
        },
      },
      {
        network: 'ethSepolia',
        chainId: 11155111,
        urls: {
          apiURL: 'https://api-sepolia.etherscan.io/api',
          browserURL: 'https://sepolia.etherscan.io',
        },
      },
      {
        network: 'baseSepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
