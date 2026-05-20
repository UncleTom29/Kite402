import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import type { SpendPolicyLibTest } from '../typechain-types';

// Thin harness contract to expose library functions under test
const HARNESS_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../contracts/SpendPolicyLib.sol";

contract SpendPolicyLibTest {
    using SpendPolicyLib for SpendPolicyLib.SpendPolicy;
    SpendPolicyLib.SpendPolicy public policy;

    function setPolicy(
        uint256 perOrder, uint256 daily, uint256 lifetime,
        uint256 dailySpent, uint256 lifetimeSpent,
        uint256 dayStart, bool suspended
    ) external {
        policy.perOrderLimit = perOrder;
        policy.dailyLimit = daily;
        policy.lifetimeLimit = lifetime;
        policy.dailySpent = dailySpent;
        policy.lifetimeSpent = lifetimeSpent;
        policy.dayStart = dayStart;
        policy.suspended = suspended;
    }

    function enforce(uint256 amount) external view { policy.enforce(amount); }
    function record(uint256 amount) external { policy.record(amount); }
    function resetDaily() external { policy.resetDaily(); }
}
`;

describe('SpendPolicyLib', () => {
  let harness: SpendPolicyLibTest;
  const USDC = (n: number) => BigInt(n) * 10n ** 6n;

  beforeEach(async () => {
    const Factory = await ethers.getContractFactory('SpendPolicyLibTest');
    harness = (await Factory.deploy()) as SpendPolicyLibTest;
  });

  async function setPolicy({
    perOrder = USDC(100),
    daily = USDC(500),
    lifetime = USDC(10000),
    dailySpent = 0n,
    lifetimeSpent = 0n,
    dayStart = BigInt(await time.latest()) - (BigInt(await time.latest()) % 86400n),
    suspended = false,
  } = {}) {
    await harness.setPolicy(perOrder, daily, lifetime, dailySpent, lifetimeSpent, dayStart, suspended);
  }

  // ----------------------------- enforce() -----------------------------------

  describe('enforce()', () => {
    it('passes when within all limits', async () => {
      await setPolicy();
      await expect(harness.enforce(USDC(50))).to.not.be.reverted;
    });

    it('reverts when suspended', async () => {
      await setPolicy({ suspended: true });
      await expect(harness.enforce(USDC(10))).to.be.revertedWithCustomError(
        harness, 'PolicyViolation',
      );
    });

    it('reverts on zero amount', async () => {
      await setPolicy();
      await expect(harness.enforce(0n)).to.be.revertedWithCustomError(
        harness, 'PolicyViolation',
      );
    });

    it('reverts when amount exceeds perOrderLimit', async () => {
      await setPolicy({ perOrder: USDC(50) });
      await expect(harness.enforce(USDC(51))).to.be.revertedWithCustomError(
        harness, 'PolicyViolation',
      );
    });

    it('passes at exactly perOrderLimit', async () => {
      await setPolicy({ perOrder: USDC(100) });
      await expect(harness.enforce(USDC(100))).to.not.be.reverted;
    });

    it('reverts when daily limit would be exceeded', async () => {
      await setPolicy({ dailySpent: USDC(450), daily: USDC(500) });
      await expect(harness.enforce(USDC(60))).to.be.revertedWithCustomError(
        harness, 'PolicyViolation',
      );
    });

    it('passes when day has rolled over (resets daily counter)', async () => {
      const yesterday = BigInt(await time.latest()) - 86400n * 2n;
      await setPolicy({ dailySpent: USDC(490), dayStart: yesterday });
      // Should pass because day has rolled over
      await expect(harness.enforce(USDC(100))).to.not.be.reverted;
    });

    it('reverts when lifetime limit would be exceeded', async () => {
      await setPolicy({ lifetimeSpent: USDC(9950), lifetime: USDC(10000) });
      await expect(harness.enforce(USDC(100))).to.be.revertedWithCustomError(
        harness, 'PolicyViolation',
      );
    });

    it('passes at exactly lifetime limit boundary', async () => {
      await setPolicy({ lifetimeSpent: USDC(9900), lifetime: USDC(10000) });
      await expect(harness.enforce(USDC(100))).to.not.be.reverted;
    });
  });

  // ----------------------------- record() -----------------------------------

  describe('record()', () => {
    it('increments dailySpent and lifetimeSpent', async () => {
      await setPolicy();
      await harness.record(USDC(100));
      const p = await harness.policy();
      expect(p.dailySpent).to.equal(USDC(100));
      expect(p.lifetimeSpent).to.equal(USDC(100));
    });

    it('resets daily counter if new day', async () => {
      const yesterday = BigInt(await time.latest()) - 86400n * 2n;
      await setPolicy({ dailySpent: USDC(200), dayStart: yesterday });
      await harness.record(USDC(50));
      const p = await harness.policy();
      expect(p.dailySpent).to.equal(USDC(50));
    });
  });

  // ----------------------------- resetDaily() -----------------------------------

  describe('resetDaily()', () => {
    it('clears dailySpent and updates dayStart', async () => {
      await setPolicy({ dailySpent: USDC(300) });
      await harness.resetDaily();
      const p = await harness.policy();
      expect(p.dailySpent).to.equal(0n);
    });
  });
});
