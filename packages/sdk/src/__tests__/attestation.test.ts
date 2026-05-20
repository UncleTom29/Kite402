import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import { hashCard } from '../attestation';

describe('hashCard', () => {
  it('produces a deterministic bytes32 hash', () => {
    const h1 = hashCard('4111111111111111', '12/26');
    const h2 = hashCard('4111111111111111', '12/26');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it('different inputs produce different hashes', () => {
    const h1 = hashCard('4111111111111111', '12/26');
    const h2 = hashCard('5500005555555559', '11/27');
    expect(h1).not.toBe(h2);
  });

  it('matches keccak256(pan+expiry)', () => {
    const pan = '4111111111111111';
    const expiry = '12/26';
    const expected = ethers.keccak256(ethers.toUtf8Bytes(pan + expiry));
    expect(hashCard(pan, expiry)).toBe(expected);
  });
});
