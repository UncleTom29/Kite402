# Kite402

> **Kite-powered wallets for AI agents. x402 → Visa card in under 60 seconds.**

Kite402 gives autonomous AI agents their own on-chain wallets (via Account Abstraction) and issues them real virtual Visa cards on demand — enforcing granular spend policies at the smart-contract level, attesting every issuance on Kite chain, and providing operators a Bloomberg-style fleet dashboard.

## Latest Updates

- Added a dedicated Audit Log view in the dashboard UI and wired it to the real `audit.list` tRPC endpoint.
- Introduced clean operator URLs (no dashboard prefix required): `/fleet`, `/approvals`, `/governance`, `/audit`, `/agents/new`, `/agents/:agentId`.
- Replaced placeholder frontend branding badges with the real Kite402 logo asset.
- Added signed Passport webhook intake route at `POST /passport/webhook` in the API.
- Added LayerZero bridge sender deployments for Ethereum Sepolia and Base Sepolia, with deployment scripts and env wiring updates.
- Stabilized local frontend runtime by adding PostCSS/Tailwind discovery config and separate Next.js dist dirs for dev/prod.

---

## What It Does

AI agents can't pay. They have no identity, no wallets, no payment rails. Kite402 solves this end-to-end using the Kite AI blockchain's full infrastructure stack.

**For agents**: A single SDK call deploys an `AgentVault` (ERC-4337 AA wallet) on Kite chain, funds it with USDC.e via a gasless EIP-3009 transfer, then issues a virtual Visa card within 60 seconds — all autonomously, with no human in the loop.

**For operators**: A real-time dashboard shows every agent's vault balance, daily/lifetime spend, and approval queue. Smart-contract spend policies (per-order, daily, lifetime limits) are enforced on-chain before every withdrawal. High-value requests are queued for human approval and resolved via signed webhooks. Every card issuance creates an immutable on-chain attestation.

**For compliance**: Raw card data (PAN, CVV) is never stored anywhere. Only `keccak256(pan+expiry)` is committed on-chain. A 24-hour timelock on multi-sig withdrawals above $1,000 USDC prevents unilateral large transfers.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AI Agent                              │
│  npx ts-node agent-demo/src/index.ts                        │
└─────────────────┬───────────────────────────────────────────┘
                  │ Kite Agent Passport session
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  @kite402/sdk                                │
│  KiteAgentWallet · GaslessTransfer · PassportProvider       │
└──────────┬──────────────────────────────┬───────────────────┘
           │ AA UserOperation             │ REST / tRPC
           ▼                              ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│   Kite Chain         │    │       Kite402 API                │
│                      │    │  (Express + tRPC + Prisma)       │
│  AgentVault.sol      │◄───│  /cards.issue                    │
│  SpendPolicyLib.sol  │    │  /agents.create                  │
│  KiteCardAttestation │    │  /approvals.*                    │
│  Kite402Registry     │    │  /governance.*                   │
│  MultiSigOperator    │    └──────────┬───────────────────────┘
│  BridgeReceiver.sol  │               │ Card PAN (one-time)
└──────────┬───────────┘               ▼
           │ Events                ┌───────────────┐
           ▼                       │  Card Issuer  │
┌──────────────────────┐           │ (Lithic/Marqeta)│
│  Goldsky Subgraph    │           └───────────────┘
│  (real-time indexer) │
│  OperatorStats       │    ┌──────────────────────────────────┐
│  AgentVaultEvents    │───►│  Kite402 Dashboard               │
│  AttestationEvents   │    │  (Next.js 14 · Tailwind · SWR)   │
└──────────────────────┘    │  Fleet · Approvals · Governance  │
                             └──────────────────────────────────┘

 ┌──────────────────────────────────────────────────────────┐
 │  LayerZero Bridge                                        │
 │  Ethereum/Base  ──BridgeSender──► BridgeReceiver──► Kite │
 └──────────────────────────────────────────────────────────┘
```

---

## Quick Start (30 seconds)

```bash
# Install the SDK
npm install @kite402/sdk ethers

# Issue a virtual Visa card in 3 lines
import { KiteAgentWallet, defaultPolicy } from '@kite402/sdk';

const wallet = new KiteAgentWallet('my-agent-id', process.env.AGENT_PRIVATE_KEY!, {
  rpcUrl: 'https://rpc-testnet.gokite.ai',
  bundlerRpc: 'https://bundler-service.staging.gokite.ai/rpc/',
  chainId: 2368,
  settlementToken: '0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63',
  vaultImplementation: process.env.AGENT_VAULT_IMPLEMENTATION_ADDRESS!,
  registryAddress: process.env.KITE402_REGISTRY_ADDRESS!,
  attestationAddress: process.env.KITE_CARD_ATTESTATION_ADDRESS!,
});

const { vaultAddress } = await wallet.deployVault(defaultPolicy());
await wallet.fund(10n * 10n ** 6n);                           // fund $10 USDC
const card = await wallet.requestCard('https://api.kite402.xyz', 5n * 10n ** 6n);
console.log(`Card: ${card.pan} | Attestation: ${card.attestationId}`);
```

---

## Kite Infrastructure Used

| Component | How Kite402 Uses It |
|---|---|
| **Kite Agent Passport** | Agent identity + scoped spending sessions — agents self-onboard via kpass CLI |
| **Account Abstraction SDK** | Gasless ERC-4337 UserOperations for vault deployment and policy updates |
| **Kite Chain (ChainID 2366/2368)** | AgentVault, SpendPolicyLib, KiteCardAttestation, Kite402Registry all live here |
| **Gasless Integration** | EIP-3009 `transferWithAuthorization` for feeless USDC.e vault funding |
| **Goldsky Indexer** | Real-time subgraph powering dashboard analytics and spend charts |
| **LayerZero V2** | Cross-chain USDC bridging from Ethereum Sepolia / Base Sepolia to Kite |
| **Multisig Wallet** | `MultiSigOperator.sol` — 2-of-N governance with 24h timelock on large withdrawals |

---

## Monorepo Structure

```
kite402/
├── packages/
│   ├── contracts/       Solidity (AgentVault, SpendPolicyLib, KiteCardAttestation,
│   │                    Kite402Registry, MultiSigOperator, BridgeSender/Receiver)
│   ├── sdk/             @kite402/sdk — TypeScript SDK for agent developers
│   ├── api/             Express + tRPC backend (Prisma/PostgreSQL, Redis)
│   ├── web/             Next.js 14 operator dashboard
│   ├── subgraph/        Goldsky AssemblyScript subgraph
│   └── agent-demo/      Autonomous agent demo (runs end-to-end in terminal)
├── deployments/         Contract addresses per network (populated after deploy)
├── docker-compose.yml   Local dev (Postgres + Redis)
└── .env.example         All required environment variables documented
```

---

## Development Setup

```bash
# Prerequisites: Node 20+, pnpm 9+, Docker

git clone https://github.com/uncletom29/kite402
cd kite402
cp .env.example .env          # fill in required values
pnpm install

# Start infra
pnpm docker:up

# Run migrations
pnpm --filter @kite402/api db:migrate

# Compile contracts
pnpm --filter @kite402/contracts build

# Start API + Dashboard
pnpm dev
```

### Dashboard Routes

- Fleet: `http://localhost:3000/fleet`
- Approvals: `http://localhost:3000/approvals`
- Governance: `http://localhost:3000/governance`
- Audit: `http://localhost:3000/audit`
- New Agent: `http://localhost:3000/agents/new`

---

## Deployment

### Smart Contracts — Kite Testnet

```bash
pnpm contracts:deploy:testnet
# Outputs addresses to deployments/kiteTestnet.json — copy to .env
```

### Smart Contracts — Kite Mainnet

```bash
pnpm contracts:deploy:mainnet
pnpm --filter @kite402/contracts run verify
```

### API — Railway

```bash
railway up --service kite402-api
```

### Dashboard — Vercel

```bash
vercel --prod
```

### Goldsky Subgraph

```bash
# Testnet
pnpm --filter @kite402/subgraph deploy:testnet

# Mainnet
pnpm --filter @kite402/subgraph deploy:mainnet
```

---

## Demo Video Script

```
00:00  Problem statement — AI agents can't pay. No wallet, no card, no rails.
00:30  Run agent-demo:
         npx ts-node packages/agent-demo/src/index.ts
       Watch it deploy a vault, fund itself, and auto-issue a Visa card.
01:15  Show dashboard — fleet overview, live vault balances, Goldsky spend chart.
02:00  Show on-chain attestation on testnet.kitescan.ai
02:30  Show approval queue — request over threshold → human approves → agent notified via webhook.
02:50  Show cross-chain funding — bridge USDC from Ethereum Sepolia via LayerZero.
03:00  Wrap: Kite Agent Passport + AA SDK + Kite Chain + Gasless + Goldsky + LayerZero + Multisig.
```

---

## Live Demo

- Dashboard: https://kite402.vercel.app
- API Docs: https://kite402.vercel.app/docs
- Testnet Explorer: https://testnet.kitescan.ai
- Video Demo: https://youtu.be/kite402-demo

---

## Security

- Card PAN and CVV are **never** persisted. Only `keccak256(pan+expiry)` is stored on-chain.
- Vault withdrawals require on-chain spend policy enforcement (per-order, daily, lifetime limits).
- High-value withdrawals (>$1,000 USDC) via MultiSigOperator have a 24-hour timelock.
- JWT-authenticated API with Redis-backed rate limiting (100 req/min per operator).
- Webhook payloads are HMAC-SHA256 signed with `WEBHOOK_SECRET`.

---

## Team

Built for the Kite AI Hackathon.

---

*Kite402 — x402 meets Kite chain. Agents that can actually pay.*
