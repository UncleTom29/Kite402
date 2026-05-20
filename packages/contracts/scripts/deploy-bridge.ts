/**
 * Deploy LayerZero bridge contracts.
 *
 * BridgeSender is deployed on source chains (Ethereum/Base).
 * BridgeReceiver is deployed on Kite chain.
 *
 * Run:
 *   Deploy BridgeReceiver on Kite:
 *     hardhat run scripts/deploy-bridge.ts --network kiteTestnet
 *
 *   Deploy BridgeSender on Ethereum Sepolia (needs separate network config):
 *     hardhat run scripts/deploy-bridge.ts --network ethSepolia
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// LayerZero V2 endpoint addresses
const LZ_ENDPOINTS: Record<number, string> = {
  2368: process.env.LZ_ENDPOINT_KITE_TESTNET ?? '0x6EDCE65403992e310A62460808c4b910D972f10f',
  40161: process.env.LZ_ENDPOINT_ETHEREUM_SEPOLIA ?? '0x6EDCE65403992e310A62460808c4b910D972f10f',
  40245: process.env.LZ_ENDPOINT_BASE_SEPOLIA ?? '0x6EDCE65403992e310A62460808c4b910D972f10f',
};

const KITE_EID = 40999; // Kite Testnet EID — confirm from https://docs.layerzero.network/v2/deployments/deployed-contracts

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log(`Deploying bridge contracts on chainId ${chainId}`);

  const endpoint = LZ_ENDPOINTS[chainId];
  if (!endpoint) throw new Error(`No LZ endpoint for chainId ${chainId}`);

  const usdcAddress = process.env.KITE_SETTLEMENT_TOKEN
    ?? (chainId === 2368 ? '0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63' : '0xUSDC_ON_SOURCE_CHAIN');

  if (chainId === 2368) {
    // Deploy BridgeReceiver on Kite chain
    const BridgeReceiver = await ethers.getContractFactory('BridgeReceiver');
    const receiver = await BridgeReceiver.deploy(endpoint, deployer.address, usdcAddress);
    await receiver.waitForDeployment();
    console.log(`BridgeReceiver: ${await receiver.getAddress()}`);

    appendToDeployment(network.name, { BridgeReceiver: await receiver.getAddress() });
  } else {
    // Deploy BridgeSender on source chain
    const BridgeSender = await ethers.getContractFactory('BridgeSender');
    const sender = await BridgeSender.deploy(endpoint, deployer.address, usdcAddress, KITE_EID);
    await sender.waitForDeployment();
    console.log(`BridgeSender: ${await sender.getAddress()}`);

    appendToDeployment(network.name, { BridgeSender: await sender.getAddress() });
  }

  console.log('✅ Bridge deployment complete');
}

function appendToDeployment(networkName: string, extra: Record<string, string>) {
  const outDir = path.resolve(__dirname, '../../../deployments');
  const outPath = path.join(outDir, `${networkName}.json`);
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(outPath)) {
    existing = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
  }
  const contracts = { ...(existing.contracts as Record<string, string> ?? {}), ...extra };
  fs.writeFileSync(outPath, JSON.stringify({ ...existing, contracts }, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
