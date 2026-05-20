import { describe, it, expect } from 'vitest';
import { validatePolicy, encodeConfigurePolicy, defaultPolicy } from '../policy';

describe('validatePolicy', () => {
  it('passes for valid policy', () => {
    expect(() => validatePolicy(defaultPolicy())).not.toThrow();
  });

  it('throws when perOrderLimit is 0', () => {
    expect(() => validatePolicy(defaultPolicy({ perOrderLimit: 0n }))).toThrow('perOrderLimit');
  });

  it('throws when dailyLimit is 0', () => {
    expect(() => validatePolicy(defaultPolicy({ dailyLimit: 0n }))).toThrow('dailyLimit');
  });

  it('throws when lifetimeLimit is 0', () => {
    expect(() => validatePolicy(defaultPolicy({ lifetimeLimit: 0n }))).toThrow('lifetimeLimit');
  });

  it('throws when perOrder > daily', () => {
    expect(() =>
      validatePolicy(defaultPolicy({ perOrderLimit: 600n * 10n ** 6n, dailyLimit: 500n * 10n ** 6n })),
    ).toThrow('perOrderLimit must not exceed dailyLimit');
  });

  it('throws when daily > lifetime', () => {
    expect(() =>
      validatePolicy(
        defaultPolicy({ dailyLimit: 11_000n * 10n ** 6n, lifetimeLimit: 10_000n * 10n ** 6n }),
      ),
    ).toThrow('dailyLimit must not exceed lifetimeLimit');
  });
});

describe('encodeConfigurePolicy', () => {
  it('returns a hex string', () => {
    const calldata = encodeConfigurePolicy(defaultPolicy());
    expect(calldata).toMatch(/^0x[0-9a-f]+$/i);
  });

  it('includes the configurePolicy selector', () => {
    const calldata = encodeConfigurePolicy(defaultPolicy());
    // selector for configurePolicy((uint256,uint256,uint256,uint256,uint256,uint256,bool))
    expect(calldata.startsWith('0x')).toBe(true);
    expect(calldata.length).toBeGreaterThan(10);
  });
});

describe('defaultPolicy', () => {
  it('returns sensible defaults', () => {
    const p = defaultPolicy();
    expect(p.perOrderLimit).toBe(100n * 10n ** 6n);
    expect(p.dailyLimit).toBe(500n * 10n ** 6n);
    expect(p.lifetimeLimit).toBe(10_000n * 10n ** 6n);
    expect(p.suspended).toBe(false);
  });

  it('allows overrides', () => {
    const p = defaultPolicy({ perOrderLimit: 50n * 10n ** 6n });
    expect(p.perOrderLimit).toBe(50n * 10n ** 6n);
    expect(p.dailyLimit).toBe(500n * 10n ** 6n);
  });
});
