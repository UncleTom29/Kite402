// Core wallet
export { KiteAgentWallet } from './wallet';

// Gasless transfers
export { GaslessTransfer } from './gasless';
export type { GaslessTransferParams } from './gasless';

// Spend policy
export { validatePolicy, encodeConfigurePolicy, defaultPolicy, AGENT_VAULT_ABI } from './policy';

// On-chain attestations
export { hashCard, attest, getAttestation, revokeAttestation } from './attestation';

// Cross-chain bridge
export { bridgeFromEthereum, bridgeFromBase, estimateBridgeFee } from './bridge';
export type { BridgeParams, BridgeResult } from './bridge';

// Kite Agent Passport
export { PassportServiceProvider, signWebhookPayload } from './passport';

// Types
export type {
  KiteConfig,
  SpendPolicy,
  CardResult,
  AttestationRecord,
  GaslessToken,
  GaslessTransferResult,
  VaultDeployResult,
  PassportServiceConfig,
  PassportSession,
} from './types';
