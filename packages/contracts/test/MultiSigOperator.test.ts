import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import type { MultiSigOperator } from '../typechain-types';

describe('MultiSigOperator', () => {
  let multisig: MultiSigOperator;
  let signers: Awaited<ReturnType<typeof ethers.getSigners>>;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    const [s1, s2, s3] = signers;
    const Factory = await ethers.getContractFactory('MultiSigOperator');
    multisig = (await Factory.deploy([s1.address, s2.address, s3.address], 2)) as MultiSigOperator;
  });

  describe('constructor', () => {
    it('sets threshold and signers', async () => {
      expect(await multisig.threshold()).to.equal(2);
      expect((await multisig.getSigners()).length).to.equal(3);
    });

    it('reverts on threshold > signers', async () => {
      const [s1] = signers;
      const Factory = await ethers.getContractFactory('MultiSigOperator');
      await expect(Factory.deploy([s1.address], 2)).to.be.reverted;
    });
  });

  describe('2-of-3 approval flow', () => {
    let proposalId: bigint;
    const DUMMY_CALL = '0x1234';

    beforeEach(async () => {
      const tx = await multisig.connect(signers[0]).proposeAction(
        signers[0].address,
        DUMMY_CALL,
        'test proposal',
      );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (l) => multisig.interface.parseLog(l as never)?.name === 'ActionProposed',
      );
      proposalId = multisig.interface.parseLog(event as never)!.args.proposalId;
    });

    it('emits ActionProposed', async () => {
      await expect(
        multisig.connect(signers[0]).proposeAction(signers[1].address, '0xabcd', 'another'),
      ).to.emit(multisig, 'ActionProposed');
    });

    it('allows signer to approve', async () => {
      await expect(multisig.connect(signers[0]).approveAction(proposalId))
        .to.emit(multisig, 'ActionApproved');
    });

    it('reverts duplicate approval', async () => {
      await multisig.connect(signers[0]).approveAction(proposalId);
      await expect(multisig.connect(signers[0]).approveAction(proposalId))
        .to.be.revertedWithCustomError(multisig, 'AlreadyApproved');
    });

    it('reverts execution below threshold', async () => {
      await multisig.connect(signers[0]).approveAction(proposalId);
      await expect(multisig.connect(signers[0]).executeAction(proposalId))
        .to.be.revertedWithCustomError(multisig, 'ThresholdNotMet');
    });

    it('executes after threshold is met', async () => {
      await multisig.connect(signers[0]).approveAction(proposalId);
      await multisig.connect(signers[1]).approveAction(proposalId);
      // DUMMY_CALL will fail as an actual call — we just verify threshold logic triggers execute
      // In a real test you'd point it at a contract method
      await expect(multisig.connect(signers[0]).executeAction(proposalId))
        .to.be.revertedWithCustomError(multisig, 'ExecutionFailed'); // call fails but threshold passed
    });

    it('allows approval revocation', async () => {
      await multisig.connect(signers[0]).approveAction(proposalId);
      await expect(multisig.connect(signers[0]).revokeApproval(proposalId))
        .to.emit(multisig, 'ApprovalRevoked');
      const [, , , , count] = await multisig.getProposal(proposalId);
      expect(count).to.equal(0);
    });

    it('non-signer cannot propose', async () => {
      const [, , , nonSigner] = signers;
      await expect(
        multisig.connect(nonSigner).proposeAction(nonSigner.address, '0x', 'bad'),
      ).to.be.revertedWithCustomError(multisig, 'NotSigner');
    });
  });

  describe('timelock for high-value withdrawals', () => {
    it('sets executeAfter for withdrawals >= HIGH_VALUE_THRESHOLD', async () => {
      const USDC_1000 = 1000n * 10n ** 6n;
      const callData = new ethers.Interface(['function withdraw(address,uint256)']).encodeFunctionData(
        'withdraw',
        [signers[1].address, USDC_1000],
      );

      const tx = await multisig.connect(signers[0]).proposeAction(
        signers[0].address,
        callData,
        'high value withdraw',
      );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (l) => multisig.interface.parseLog(l as never)?.name === 'ActionProposed',
      );
      const proposalId = multisig.interface.parseLog(event as never)!.args.proposalId;

      const [, , , executeAfter] = await multisig.getProposal(proposalId);
      expect(executeAfter).to.be.gt(0);

      // Approve 2-of-3
      await multisig.connect(signers[0]).approveAction(proposalId);
      await multisig.connect(signers[1]).approveAction(proposalId);

      // Should fail — timelock active
      await expect(multisig.connect(signers[0]).executeAction(proposalId))
        .to.be.revertedWithCustomError(multisig, 'TimelockActive');

      // Fast-forward 25 hours
      await time.increase(25 * 3600);

      // Now it should pass threshold check (even if underlying call fails)
      await expect(multisig.connect(signers[0]).executeAction(proposalId))
        .to.be.revertedWithCustomError(multisig, 'ExecutionFailed'); // call fails, but timelock passed
    });
  });
});
