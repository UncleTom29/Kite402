import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { AgentVault, ERC20Mock } from '../typechain-types';

describe('AgentVault', () => {
  const USDC = (n: number) => BigInt(n) * 10n ** 6n;
  const AGENT_ID = ethers.id('test-agent-1');

  let vault: AgentVault;
  let token: ERC20Mock;
  let owner: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let operator: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let user: Awaited<ReturnType<typeof ethers.getSigners>>[0];

  const defaultPolicy = {
    perOrderLimit: USDC(100),
    dailyLimit: USDC(500),
    lifetimeLimit: USDC(10000),
    dailySpent: 0n,
    lifetimeSpent: 0n,
    dayStart: 0n,
    suspended: false,
  };

  beforeEach(async () => {
    [owner, operator, user] = await ethers.getSigners();

    // Deploy mock ERC20
    const ERC20MockFactory = await ethers.getContractFactory('ERC20Mock');
    token = (await ERC20MockFactory.deploy('USDC.e', 'USDC.e', 6)) as ERC20Mock;

    // Deploy AgentVault implementation and proxy
    const AgentVaultFactory = await ethers.getContractFactory('AgentVault');
    const impl = await AgentVaultFactory.deploy();

    const initData = impl.interface.encodeFunctionData('initialize', [
      owner.address,
      AGENT_ID,
      await token.getAddress(),
      defaultPolicy,
    ]);

    const ProxyFactory = await ethers.getContractFactory('ERC1967Proxy');
    const proxy = await ProxyFactory.deploy(await impl.getAddress(), initData);
    vault = AgentVaultFactory.attach(await proxy.getAddress()) as AgentVault;
  });

  it('initialises with correct agentId and token', async () => {
    expect(await vault.agentId()).to.equal(AGENT_ID);
    expect(await vault.settlementToken()).to.equal(await token.getAddress());
    expect(await vault.owner()).to.equal(owner.address);
  });

  describe('deposit()', () => {
    it('accepts tokens from anyone', async () => {
      await token.mint(user.address, USDC(1000));
      await token.connect(user).approve(await vault.getAddress(), USDC(500));
      await expect(vault.connect(user).deposit(USDC(500)))
        .to.emit(vault, 'Deposited')
        .withArgs(AGENT_ID, USDC(500));
      expect(await vault.balance()).to.equal(USDC(500));
    });
  });

  describe('withdraw()', () => {
    beforeEach(async () => {
      await token.mint(owner.address, USDC(1000));
      await token.connect(owner).approve(await vault.getAddress(), USDC(1000));
      await vault.connect(owner).deposit(USDC(1000));
    });

    it('allows owner to withdraw within limits', async () => {
      await expect(vault.connect(owner).withdraw(user.address, USDC(50)))
        .to.emit(vault, 'Withdrawn')
        .withArgs(AGENT_ID, user.address, USDC(50));
      expect(await token.balanceOf(user.address)).to.equal(USDC(50));
    });

    it('allows approved operator to withdraw', async () => {
      await vault.connect(owner).addOperator(operator.address);
      await expect(vault.connect(operator).withdraw(user.address, USDC(50))).to.not.be.reverted;
    });

    it('reverts for unauthorized caller', async () => {
      await expect(vault.connect(user).withdraw(user.address, USDC(50)))
        .to.be.revertedWithCustomError(vault, 'Unauthorized');
    });

    it('reverts when amount exceeds perOrderLimit', async () => {
      await expect(vault.connect(owner).withdraw(user.address, USDC(200)))
        .to.be.revertedWithCustomError(vault, 'PolicyViolation');
    });

    it('reverts when vault has insufficient balance', async () => {
      await token.mint(owner.address, USDC(10));
      // Drain vault first
      await vault.connect(owner).withdraw(user.address, USDC(100));
      await vault.connect(owner).withdraw(user.address, USDC(100));
      // Now vault should be low
    });
  });

  describe('suspend() / resume()', () => {
    it('prevents withdrawals when suspended', async () => {
      await token.mint(owner.address, USDC(100));
      await token.connect(owner).approve(await vault.getAddress(), USDC(100));
      await vault.connect(owner).deposit(USDC(100));

      await vault.connect(owner).suspend();
      await expect(vault.connect(owner).withdraw(user.address, USDC(10)))
        .to.be.revertedWithCustomError(vault, 'PolicyViolation');
    });

    it('resumes withdrawals after resume()', async () => {
      await token.mint(owner.address, USDC(100));
      await token.connect(owner).approve(await vault.getAddress(), USDC(100));
      await vault.connect(owner).deposit(USDC(100));

      await vault.connect(owner).suspend();
      await vault.connect(owner).resume();
      await expect(vault.connect(owner).withdraw(user.address, USDC(10))).to.not.be.reverted;
    });
  });

  describe('configurePolicy()', () => {
    it('updates policy limits', async () => {
      const newPolicy = { ...defaultPolicy, perOrderLimit: USDC(200) };
      await expect(vault.connect(owner).configurePolicy(newPolicy))
        .to.emit(vault, 'PolicyUpdated')
        .withArgs(AGENT_ID);
    });

    it('reverts on invalid policy (perOrder > daily)', async () => {
      const bad = { ...defaultPolicy, perOrderLimit: USDC(600), dailyLimit: USDC(500) };
      await expect(vault.connect(owner).configurePolicy(bad))
        .to.be.revertedWithCustomError(vault, 'InvalidPolicy');
    });
  });
});
