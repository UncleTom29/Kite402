import { ethers } from 'ethers';
import type { SpendPolicy } from './types';

// AgentVault ABI (minimal — just the policy functions needed by the SDK)
const AGENT_VAULT_ABI = [
  'function configurePolicy((uint256 perOrderLimit,uint256 dailyLimit,uint256 lifetimeLimit,uint256 dailySpent,uint256 lifetimeSpent,uint256 dayStart,bool suspended) _policy)',
  'function getPolicy() view returns ((uint256 perOrderLimit,uint256 dailyLimit,uint256 lifetimeLimit,uint256 dailySpent,uint256 lifetimeSpent,uint256 dayStart,bool suspended))',
  'function suspend()',
  'function resume()',
];

/**
 * Validates a SpendPolicy — throws if any limit is zero or inconsistent.
 */
export function validatePolicy(policy: SpendPolicy): void {
  if (policy.perOrderLimit === 0n) throw new Error('perOrderLimit must be > 0');
  if (policy.dailyLimit === 0n) throw new Error('dailyLimit must be > 0');
  if (policy.lifetimeLimit === 0n) throw new Error('lifetimeLimit must be > 0');
  if (policy.perOrderLimit > policy.dailyLimit) {
    throw new Error('perOrderLimit must not exceed dailyLimit');
  }
  if (policy.dailyLimit > policy.lifetimeLimit) {
    throw new Error('dailyLimit must not exceed lifetimeLimit');
  }
}

/**
 * Encodes the calldata for AgentVault.configurePolicy().
 */
export function encodeConfigurePolicy(policy: SpendPolicy): string {
  validatePolicy(policy);

  const iface = new ethers.Interface(AGENT_VAULT_ABI);
  return iface.encodeFunctionData('configurePolicy', [
    {
      perOrderLimit: policy.perOrderLimit,
      dailyLimit: policy.dailyLimit,
      lifetimeLimit: policy.lifetimeLimit,
      dailySpent: policy.dailySpent ?? 0n,
      lifetimeSpent: policy.lifetimeSpent ?? 0n,
      dayStart: policy.dayStart ?? 0n,
      suspended: policy.suspended ?? false,
    },
  ]);
}

/**
 * Returns a default per-amount policy with common-sense limits.
 * All amounts in USDC with 6 decimals.
 */
export function defaultPolicy(overrides: Partial<SpendPolicy> = {}): SpendPolicy {
  return {
    perOrderLimit: 100n * 10n ** 6n,    // $100 per order
    dailyLimit: 500n * 10n ** 6n,       // $500/day
    lifetimeLimit: 10_000n * 10n ** 6n, // $10,000 lifetime
    dailySpent: 0n,
    lifetimeSpent: 0n,
    dayStart: 0n,
    suspended: false,
    ...overrides,
  };
}

export { AGENT_VAULT_ABI };
