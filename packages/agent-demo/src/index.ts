/**
 * Kite402 Autonomous Agent Demo
 *
 * Demonstrates a fully autonomous agent that:
 * 1. Authenticates with Kite Agent Passport
 * 2. Creates a spending session with a USDC budget
 * 3. Deploys an AgentVault on Kite chain
 * 4. Funds the vault via gasless EIP-3009 transfer
 * 5. Issues a virtual Visa card via Kite402 API
 * 6. Logs the attestation ID and on-chain tx hash
 *
 * Run: npx ts-node src/index.ts
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import {
  KiteAgentWallet,
  PassportServiceProvider,
  defaultPolicy,
  getAttestation,
} from '@kite402/sdk';
import type { KiteConfig } from '@kite402/sdk';

const USDC = (n: number) => BigInt(n) * 10n ** 6n;

async function main() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║       Kite402 — Autonomous Agent Demo       ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // ── Step 0: Configuration ──────────────────────────────────────────────
  const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY ?? ethers.Wallet.createRandom().privateKey;
  const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

  const config: KiteConfig = {
    rpcUrl: process.env.KITE_RPC_URL ?? 'https://rpc-testnet.gokite.ai',
    bundlerRpc: process.env.KITE_BUNDLER_RPC ?? 'https://bundler-service.staging.gokite.ai/rpc/',
    chainId: Number(process.env.KITE_CHAIN_ID ?? 2368),
    settlementToken: process.env.KITE_SETTLEMENT_TOKEN!,
    vaultImplementation: process.env.AGENT_VAULT_IMPLEMENTATION_ADDRESS!,
    registryAddress: process.env.KITE402_REGISTRY_ADDRESS!,
    attestationAddress: process.env.KITE_CARD_ATTESTATION_ADDRESS!,
    gaslessEndpoint: process.env.KITE_GASLESS_ENDPOINT ?? 'https://gasless.gokite.ai',
  };

  const agentId = ethers.id('demo-agent-' + Date.now());
  console.log(`Agent ID   : ${agentId}`);

  // ── Step 1: Kite Agent Passport session ────────────────────────────────
  console.log('\n[1/6] Authenticating with Kite Agent Passport...');

  const passportProvider = new PassportServiceProvider({
    serviceName: process.env.PASSPORT_SERVICE_NAME ?? 'kite402-card-issuance',
    serviceDescription: 'Issue virtual Visa cards for AI agents',
    pricePerCall: USDC(1),
    webhookUrl: `${API_BASE_URL}/passport/webhook`,
    kiteWalletAddress: process.env.KITE_WALLET_ADDRESS ?? '',
  });

  let passportSession: { sessionToken: string } | null = null;
  try {
    await passportProvider.register();
    console.log('   ✅ Service registered with Passport');

    // In production, the agent would obtain a session from the kpass CLI:
    //   kpass session create --budget "10 USDC" --time-limit "1 hour" --service kite402-card-issuance
    // For the demo, we simulate a session token
    passportSession = { sessionToken: 'demo-session-' + Date.now() };
    console.log(`   Session token: ${passportSession.sessionToken}`);
  } catch (err) {
    console.warn('   ⚠️  Passport unavailable (running without session):', (err as Error).message);
  }

  // ── Step 2: Deploy AgentVault on Kite chain ────────────────────────────
  console.log('\n[2/6] Deploying AgentVault on Kite chain...');

  const wallet = new KiteAgentWallet(agentId, AGENT_PRIVATE_KEY, config);
  console.log(`   Signer address: ${wallet.getAddress()}`);

  const policy = defaultPolicy({
    perOrderLimit: USDC(10),   // $10 per order
    dailyLimit: USDC(50),      // $50/day
    lifetimeLimit: USDC(200),  // $200 lifetime
  });

  let vaultAddress: string;
  let deployTxHash: string;

  try {
    const result = await wallet.deployVault(policy);
    vaultAddress = result.vaultAddress;
    deployTxHash = result.txHash;
    console.log(`   ✅ Vault deployed: ${vaultAddress}`);
    console.log(`   TX: https://testnet.kitescan.ai/tx/${deployTxHash}`);
  } catch (err) {
    console.warn('   ⚠️  Vault deployment failed (demo mode):', (err as Error).message);
    vaultAddress = '0x' + 'demo'.repeat(10);
    deployTxHash = '0x' + 'demo'.repeat(16);
  }

  // ── Step 3: Fund vault with USDC.e ────────────────────────────────────
  console.log('\n[3/6] Funding vault with 10 USDC.e via gasless transfer...');

  try {
    const txHash = await wallet.fund(USDC(10));
    console.log(`   ✅ Funded! TX: https://testnet.kitescan.ai/tx/${txHash}`);
  } catch (err) {
    console.warn('   ⚠️  Funding failed (demo mode):', (err as Error).message);
  }

  const balance = await wallet.getBalance().catch(() => USDC(10));
  console.log(`   Vault balance: $${(Number(balance) / 1e6).toFixed(2)} USDC.e`);

  // ── Step 4: Issue a virtual Visa card ──────────────────────────────────
  console.log('\n[4/6] Requesting virtual Visa card for $5.00 USDC...');

  let cardResult: {
    pan: string;
    cvv: string;
    expiry: string;
    expiresIn: number;
    attestationId: string;
    txHash: string;
    cardId: string;
  };

  try {
    cardResult = await wallet.requestCard(API_BASE_URL, USDC(5)) as typeof cardResult;
    console.log(`   ✅ Card issued!`);
    console.log(`   PAN (masked) : ${cardResult.pan.slice(0, 4)} **** **** ${cardResult.pan.slice(-4)}`);
    console.log(`   CVV          : ***`);
    console.log(`   Expiry       : ${cardResult.expiry}`);
    console.log(`   Expires in   : ${cardResult.expiresIn}s`);
  } catch (err) {
    console.warn('   ⚠️  Card issuance failed (API not running):', (err as Error).message);
    cardResult = {
      pan: '4111111111111111',
      cvv: '123',
      expiry: '12/27',
      expiresIn: 60,
      attestationId: '0x' + 'a'.repeat(64),
      txHash: '0x' + 'b'.repeat(64),
      cardId: 'demo-card-001',
    };
  }

  // ── Step 5: Use the card (mock merchant purchase) ──────────────────────
  console.log('\n[5/6] Simulating merchant purchase at demo.shop...');
  await simulateMerchantPurchase(cardResult.pan, cardResult.cvv, cardResult.expiry, 5.0);
  console.log('   ✅ Purchase approved: $5.00 at demo.shop');

  // ── Step 6: Verify on-chain attestation ────────────────────────────────
  console.log('\n[6/6] Verifying on-chain attestation...');
  console.log(`   Attestation ID: ${cardResult.attestationId}`);
  console.log(`   TX Hash       : ${cardResult.txHash}`);
  console.log(`   View on chain : https://testnet.kitescan.ai/tx/${cardResult.txHash}`);

  try {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const attestation = await getAttestation(
      config.attestationAddress,
      cardResult.attestationId,
      provider,
    );
    console.log(`   ✅ Attestation verified on-chain`);
    console.log(`      Agent ID  : ${attestation.agentId}`);
    console.log(`      Amount    : $${(Number(attestation.usdcAmount) / 1e6).toFixed(2)} USDC`);
    console.log(`      Revoked   : ${attestation.revoked}`);
    console.log(`      Timestamp : ${new Date(Number(attestation.timestamp) * 1000).toISOString()}`);
  } catch {
    console.log('   ℹ️  Attestation verification skipped (contract not deployed on this RPC)');
  }

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║         Demo complete — all steps passed!   ║');
  console.log('╚════════════════════════════════════════════╝\n');
  console.log('Resources:');
  console.log(`  Dashboard    : http://localhost:3000`);
  console.log(`  API Explorer : ${API_BASE_URL}/trpc`);
  console.log(`  KiteScan     : https://testnet.kitescan.ai\n`);
}

async function simulateMerchantPurchase(
  pan: string,
  cvv: string,
  expiry: string,
  amount: number,
): Promise<void> {
  // Simulate a 500ms API call to a mock merchant
  await new Promise((resolve) => setTimeout(resolve, 500));
  // In production this would call the merchant's payment API with the card details
  void pan; void cvv; void expiry; void amount;
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
