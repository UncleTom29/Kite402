export interface KiteConfig {
  rpcUrl: string;
  bundlerRpc: string;
  chainId: number;
  settlementToken: string;       // USDC.e contract address
  vaultImplementation: string;   // AgentVault implementation address
  registryAddress: string;       // Kite402Registry address
  attestationAddress: string;    // KiteCardAttestation address
  gaslessEndpoint?: string;      // defaults to https://gasless.gokite.ai
}

export interface SpendPolicy {
  perOrderLimit: bigint;
  dailyLimit: bigint;
  lifetimeLimit: bigint;
  dailySpent?: bigint;
  lifetimeSpent?: bigint;
  dayStart?: bigint;
  suspended?: boolean;
}

export interface CardResult {
  pan: string;
  cvv: string;
  expiry: string;          // MM/YY
  expiresInSeconds: number;
  attestationId: string;   // bytes32 hex
  txHash: string;
}

export interface AttestationRecord {
  agentId: string;
  usdcAmount: bigint;
  cardHash: string;
  timestamp: bigint;
  revoked: boolean;
}

export interface GaslessToken {
  address: string;
  symbol: string;
  decimals: number;
  eip712Name: string;
  eip712Version: string;
}

export interface GaslessTransferResult {
  txHash: string;
}

export interface VaultDeployResult {
  vaultAddress: string;
  txHash: string;
}

export interface PassportServiceConfig {
  serviceName: string;
  serviceDescription: string;
  pricePerCall: bigint;
  webhookUrl: string;
  kiteWalletAddress: string;
}

export interface PassportSession {
  sessionToken: string;
  agentId: string;
  budget: bigint;          // USDC amount approved for this session
  expiresAt: number;       // unix timestamp
  spentSoFar: bigint;
}
