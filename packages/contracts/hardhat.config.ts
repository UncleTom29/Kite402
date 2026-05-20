import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? '0x' + '0'.repeat(64);

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
      url: process.env.KITE_RPC_URL ?? 'https://rpc-testnet.gokite.ai',
      chainId: 2368,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    kiteMainnet: {
      url: process.env.KITE_RPC_URL_MAINNET ?? 'https://rpc.gokite.ai',
      chainId: 2366,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      kiteTestnet: 'no-api-key-needed',
      kiteMainnet: 'no-api-key-needed',
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
