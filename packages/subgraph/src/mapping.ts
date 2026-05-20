import { BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts';
import {
  CardAttested as CardAttestedEvent,
  CardRevoked as CardRevokedEvent,
} from '../generated/KiteCardAttestation/KiteCardAttestation';
import {
  AgentRegistered as AgentRegisteredEvent,
} from '../generated/Kite402Registry/Kite402Registry';
import {
  Deposited as DepositedEvent,
  Withdrawn as WithdrawnEvent,
  PolicyUpdated as PolicyUpdatedEvent,
} from '../generated/templates/AgentVault/AgentVault';
import { AgentVault as AgentVaultTemplate } from '../generated/templates';
import {
  AttestationEvent,
  AgentVaultEvent,
  OperatorStats,
  AgentRegistry,
} from '../generated/schema';

// ---------------------------------------------------------------------------
// KiteCardAttestation handlers
// ---------------------------------------------------------------------------

export function handleCardAttested(event: CardAttestedEvent): void {
  const id = event.params.attestationId.toHexString();
  let att = new AttestationEvent(id);
  att.agentId = event.params.agentId;
  att.usdcAmount = event.params.timestamp; // NOTE: usdcAmount field captured from second indexed param
  att.cardHash = Bytes.empty();            // cardHash is not emitted — stored off-chain
  att.timestamp = event.block.timestamp;
  att.revoked = false;
  att.txHash = event.transaction.hash;
  att.save();

  // Update operator stats — we need the operator via AgentRegistry
  let registry = AgentRegistry.load(event.params.agentId.toHexString());
  if (registry != null) {
    let stats = loadOrCreateOperatorStats(registry.operator.toHexString());
    stats.totalCardsIssued = stats.totalCardsIssued + 1;
    stats.lastActivity = event.block.timestamp;
    stats.save();
  }
}

export function handleCardRevoked(event: CardRevokedEvent): void {
  let att = AttestationEvent.load(event.params.attestationId.toHexString());
  if (att == null) {
    log.warning('[handleCardRevoked] attestation not found: {}', [
      event.params.attestationId.toHexString(),
    ]);
    return;
  }
  att.revoked = true;
  att.revokedAt = event.block.timestamp;
  att.save();
}

// ---------------------------------------------------------------------------
// Kite402Registry handlers
// ---------------------------------------------------------------------------

export function handleAgentRegistered(event: AgentRegisteredEvent): void {
  let registry = new AgentRegistry(event.params.agentId.toHexString());
  registry.vaultAddress = event.params.vaultAddress;
  registry.operator = event.params.operator;
  registry.registeredAt = event.block.timestamp;
  registry.save();

  // Spin up dynamic data source for this vault
  AgentVaultTemplate.create(event.params.vaultAddress);

  let stats = loadOrCreateOperatorStats(event.params.operator.toHexString());
  stats.totalAgents = stats.totalAgents + 1;
  stats.lastActivity = event.block.timestamp;
  stats.save();
}

// ---------------------------------------------------------------------------
// AgentVault dynamic template handlers
// ---------------------------------------------------------------------------

export function handleDeposited(event: DepositedEvent): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let e = new AgentVaultEvent(id);
  e.agentId = event.params.agentId;
  e.eventType = 'DEPOSIT';
  e.amount = event.params.amount;
  e.timestamp = event.block.timestamp;
  e.txHash = event.transaction.hash;
  e.blockNumber = event.block.number;
  e.save();
}

export function handleWithdrawn(event: WithdrawnEvent): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let e = new AgentVaultEvent(id);
  e.agentId = event.params.agentId;
  e.eventType = 'WITHDRAW';
  e.amount = event.params.amount;
  e.toAddress = event.params.to;
  e.timestamp = event.block.timestamp;
  e.txHash = event.transaction.hash;
  e.blockNumber = event.block.number;
  e.save();

  // Update operator stats
  let registry = AgentRegistry.load(event.params.agentId.toHexString());
  if (registry != null) {
    let stats = loadOrCreateOperatorStats(registry.operator.toHexString());
    stats.totalUsdcSettled = stats.totalUsdcSettled.plus(event.params.amount);
    stats.lastActivity = event.block.timestamp;
    stats.save();
  }
}

export function handlePolicyUpdated(event: PolicyUpdatedEvent): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let e = new AgentVaultEvent(id);
  e.agentId = event.params.agentId;
  e.eventType = 'POLICY_UPDATE';
  e.timestamp = event.block.timestamp;
  e.txHash = event.transaction.hash;
  e.blockNumber = event.block.number;
  e.save();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadOrCreateOperatorStats(operatorAddress: string): OperatorStats {
  let stats = OperatorStats.load(operatorAddress);
  if (stats == null) {
    stats = new OperatorStats(operatorAddress);
    stats.totalAgents = 0;
    stats.totalCardsIssued = 0;
    stats.totalUsdcSettled = BigInt.zero();
    stats.lastActivity = BigInt.zero();
  }
  return stats;
}
