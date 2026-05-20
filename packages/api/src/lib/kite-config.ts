import type { KiteConfig } from '@kite402/sdk';

export function getKiteConfig(): KiteConfig {
  return {
    rpcUrl: process.env.KITE_RPC_URL ?? 'https://rpc-testnet.gokite.ai',
    bundlerRpc: process.env.KITE_BUNDLER_RPC ?? 'https://bundler-service.staging.gokite.ai/rpc/',
    chainId: Number(process.env.KITE_CHAIN_ID ?? 2368),
    settlementToken: process.env.KITE_SETTLEMENT_TOKEN!,
    vaultImplementation: process.env.KITE_VAULT_IMPLEMENTATION ?? process.env.AGENT_VAULT_IMPLEMENTATION_ADDRESS!,
    registryAddress: process.env.KITE402_REGISTRY_ADDRESS!,
    attestationAddress: process.env.KITE_CARD_ATTESTATION_ADDRESS!,
    gaslessEndpoint: process.env.KITE_GASLESS_ENDPOINT ?? 'https://gasless.gokite.ai',
  };
}
