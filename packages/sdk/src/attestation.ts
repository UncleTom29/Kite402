import { ethers } from 'ethers';
import type { AttestationRecord } from './types';

const ATTESTATION_ABI = [
  'function attest(bytes32 agentId, uint256 usdcAmount, bytes32 cardHash) returns (bytes32)',
  'function revoke(bytes32 attestationId)',
  'function getAttestation(bytes32 attestationId) view returns (tuple(bytes32 agentId,uint256 usdcAmount,bytes32 cardHash,uint256 timestamp,bool revoked))',
  'function hashCard(string pan, string expiry) pure returns (bytes32)',
];

/**
 * Hashes a card PAN + expiry using keccak256.
 * Raw card data is NEVER logged or persisted.
 */
export function hashCard(pan: string, expiry: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(pan + expiry));
}

/**
 * Creates an on-chain attestation for a card issuance event.
 */
export async function attest(
  attestationContractAddress: string,
  agentId: string,
  usdcAmount: bigint,
  cardHash: string,
  signer: ethers.Signer,
): Promise<string> {
  const contract = new ethers.Contract(attestationContractAddress, ATTESTATION_ABI, signer);
  const tx = await contract.attest(agentId, usdcAmount, cardHash);
  const receipt = await tx.wait();

  // Extract attestationId from the CardAttested event
  const iface = new ethers.Interface(ATTESTATION_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'CardAttested') {
        return parsed.args.attestationId as string;
      }
    } catch {
      // not our log
    }
  }

  throw new Error('CardAttested event not found in transaction receipt');
}

/**
 * Retrieves an attestation record from the chain.
 */
export async function getAttestation(
  attestationContractAddress: string,
  attestationId: string,
  provider: ethers.Provider,
): Promise<AttestationRecord> {
  const contract = new ethers.Contract(attestationContractAddress, ATTESTATION_ABI, provider);
  const raw = await contract.getAttestation(attestationId);
  return {
    agentId: raw.agentId as string,
    usdcAmount: raw.usdcAmount as bigint,
    cardHash: raw.cardHash as string,
    timestamp: raw.timestamp as bigint,
    revoked: raw.revoked as boolean,
  };
}

/**
 * Revokes an attestation (e.g. on card revocation).
 */
export async function revokeAttestation(
  attestationContractAddress: string,
  attestationId: string,
  signer: ethers.Signer,
): Promise<string> {
  const contract = new ethers.Contract(attestationContractAddress, ATTESTATION_ABI, signer);
  const tx = await contract.revoke(attestationId);
  const receipt = await tx.wait();
  return receipt.hash as string;
}
