# Kite402 Agent Demo

An autonomous agent that deploys its own AA wallet, funds it with USDC.e, and issues a virtual Visa card — all without human intervention after session approval.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Kite testnet wallet with some KITE for gas
- USDC.e on Kite testnet ([faucet](https://faucet.gokite.ai))

## Setup

```bash
# From the monorepo root
pnpm install

# Copy and fill environment variables
cp ../../.env.example ../../.env
# Required vars for the demo:
#   KITE_RPC_URL
#   KITE_SETTLEMENT_TOKEN
#   AGENT_VAULT_IMPLEMENTATION_ADDRESS
#   KITE402_REGISTRY_ADDRESS
#   KITE_CARD_ATTESTATION_ADDRESS
#   AGENT_PRIVATE_KEY         (a fresh wallet funded with KITE)
#   API_BASE_URL              (e.g. http://localhost:4000)
```

## Running

```bash
# Start the API + DB first
cd ../../
pnpm docker:up
pnpm --filter @kite402/api db:migrate
pnpm --filter @kite402/api dev &

# Then run the demo
cd packages/agent-demo
npx ts-node src/index.ts
```

## What It Does

| Step | Action |
|------|--------|
| 1 | Authenticates with Kite Agent Passport and creates a spending session ($10 USDC budget, 1h) |
| 2 | Deploys an `AgentVault` proxy on Kite chain via Account Abstraction |
| 3 | Funds the vault with 10 USDC.e using a gasless EIP-3009 `transferWithAuthorization` |
| 4 | Calls the Kite402 API to issue a virtual Visa card for $5.00 |
| 5 | Simulates a merchant purchase with the returned PAN |
| 6 | Verifies the on-chain attestation on KiteCardAttestation contract |

## Expected Output

```
╔════════════════════════════════════════════╗
║       Kite402 — Autonomous Agent Demo       ║
╚════════════════════════════════════════════╝

Agent ID   : 0x...

[1/6] Authenticating with Kite Agent Passport...
   ✅ Service registered with Passport
   Session token: demo-session-...

[2/6] Deploying AgentVault on Kite chain...
   Signer address: 0x...
   ✅ Vault deployed: 0x...
   TX: https://testnet.kitescan.ai/tx/0x...

[3/6] Funding vault with 10 USDC.e via gasless transfer...
   ✅ Funded! TX: https://testnet.kitescan.ai/tx/0x...
   Vault balance: $10.00 USDC.e

[4/6] Requesting virtual Visa card for $5.00 USDC...
   ✅ Card issued!
   PAN (masked) : 4111 **** **** 1111
   CVV          : ***
   Expiry       : 12/27
   Expires in   : 60s

[5/6] Simulating merchant purchase at demo.shop...
   ✅ Purchase approved: $5.00 at demo.shop

[6/6] Verifying on-chain attestation...
   Attestation ID: 0x...
   TX Hash       : 0x...
   View on chain : https://testnet.kitescan.ai/tx/0x...
   ✅ Attestation verified on-chain
```
