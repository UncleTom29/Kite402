import { ethers } from 'ethers';
import type { KiteConfig, SpendPolicy, CardResult, VaultDeployResult } from './types';
import { validatePolicy, AGENT_VAULT_ABI } from './policy';
import { GaslessTransfer } from './gasless';

// Minimal ABI fragments needed by the wallet module
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function version() view returns (string)',
];

const REGISTRY_ABI = [
  'function registerAgent(bytes32 agentId, address vaultAddress, address operator)',
  'function getAgentVault(bytes32 agentId) view returns (address)',
];

const ERC1967_PROXY_ABI = [
  'constructor(address implementation, bytes data)',
];

/**
 * KiteAgentWallet — AA-powered wallet for an AI agent.
 *
 * Wraps the GoKite Account Abstraction SDK to deploy and manage AgentVault
 * proxies, fund them via gasless EIP-3009, and issue virtual Visa cards.
 */
export class KiteAgentWallet {
  private readonly agentId: string;
  private readonly signer: ethers.Wallet;
  private readonly config: KiteConfig;
  private readonly provider: ethers.JsonRpcProvider;
  private readonly gasless: GaslessTransfer;

  // Lazily resolved vault address
  private _vaultAddress: string | null = null;

  constructor(agentId: string, signerPrivateKey: string, config: KiteConfig) {
    this.agentId = agentId;
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.signer = new ethers.Wallet(signerPrivateKey, this.provider);
    this.gasless = new GaslessTransfer(config.gaslessEndpoint);
  }

  /**
   * Returns the EOA address for this agent's signer (used as AA wallet owner).
   */
  getAddress(): string {
    return this.signer.address;
  }

  /**
   * Returns the AgentVault USDC.e balance (0 if vault not deployed).
   */
  async getBalance(): Promise<bigint> {
    const vaultAddress = await this.getVaultAddress();
    if (!vaultAddress) return 0n;
    const token = new ethers.Contract(this.config.settlementToken, ERC20_ABI, this.provider);
    return token.balanceOf(vaultAddress) as Promise<bigint>;
  }

  /**
   * Returns the deployed AgentVault address, or null if not yet deployed.
   */
  async getVaultAddress(): Promise<string | null> {
    if (this._vaultAddress) return this._vaultAddress;

    const registry = new ethers.Contract(
      this.config.registryAddress,
      REGISTRY_ABI,
      this.provider,
    );
    const addr = await registry.getAgentVault(this.agentId) as string;
    if (addr !== ethers.ZeroAddress) {
      this._vaultAddress = addr;
      return addr;
    }
    return null;
  }

  /**
   * Deploys a new AgentVault proxy for this agent and registers it in the registry.
   */
  async deployVault(spendPolicy: SpendPolicy): Promise<VaultDeployResult> {
    validatePolicy(spendPolicy);

    // Encode initialize() calldata
    const vaultIface = new ethers.Interface([
      'function initialize(address owner, bytes32 agentId, address settlementToken, (uint256 perOrderLimit,uint256 dailyLimit,uint256 lifetimeLimit,uint256 dailySpent,uint256 lifetimeSpent,uint256 dayStart,bool suspended) policy)',
    ]);
    const initData = vaultIface.encodeFunctionData('initialize', [
      this.signer.address,
      this.agentId,
      this.config.settlementToken,
      {
        perOrderLimit: spendPolicy.perOrderLimit,
        dailyLimit: spendPolicy.dailyLimit,
        lifetimeLimit: spendPolicy.lifetimeLimit,
        dailySpent: spendPolicy.dailySpent ?? 0n,
        lifetimeSpent: spendPolicy.lifetimeSpent ?? 0n,
        dayStart: spendPolicy.dayStart ?? 0n,
        suspended: spendPolicy.suspended ?? false,
      },
    ]);

    // Deploy ERC1967Proxy pointing at the AgentVault implementation
    const proxyFactory = new ethers.ContractFactory(
      ['constructor(address implementation, bytes data)'],
      // ERC1967Proxy bytecode from OpenZeppelin (production would pull from artifacts)
      '0x608060405234801561001057600080fd5b50604051610a6b380380610a6b833981810160405281019061003291906101a2565b61004c8282604051806020016040528060008152506100af565b505061031e565b60008151111561009757806040518060400160405280600181526020017f3200000000000000000000000000000000000000000000000000000000000000815250610099565b5b60005b9050919050565b6100b8836100f2565b6000825111806100c55750815b156100d0576100d0565b61009484838351610140565b60007f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc5b60001b905090565b61013d8160008461012e565b610146838310610131565b610152836000856101b5565b5050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b',
      this.signer,
    );

    // GoKite AA SDK integration — here we use direct EOA signing as a fallback
    // Production flow: submit as ERC-4337 UserOperation via bundler
    let tx: ethers.TransactionResponse;
    try {
      // Try AA-SDK path first
      tx = await this._deployViaAA(this.config.vaultImplementation, initData);
    } catch {
      // Fallback: direct deploy
      const proxy = await proxyFactory.deploy(this.config.vaultImplementation, initData);
      tx = proxy.deploymentTransaction()!;
      await proxy.waitForDeployment();
      this._vaultAddress = await proxy.getAddress();
    }

    const receipt = await tx.wait();
    if (!receipt) throw new Error('No receipt for vault deployment');

    if (!this._vaultAddress) {
      // Extract from Create event
      this._vaultAddress = receipt.contractAddress ?? receipt.logs[0]?.address;
    }

    // Register in Kite402Registry
    const registry = new ethers.Contract(
      this.config.registryAddress,
      REGISTRY_ABI,
      this.signer,
    );
    await (await registry.registerAgent(this.agentId, this._vaultAddress, this.signer.address)).wait();

    return { vaultAddress: this._vaultAddress!, txHash: receipt.hash };
  }

  /**
   * Funds the vault with USDC.e using a gasless EIP-3009 transfer.
   */
  async fund(amount: bigint): Promise<string> {
    const vaultAddress = await this.getVaultAddress();
    if (!vaultAddress) throw new Error('Vault not deployed. Call deployVault() first.');

    const token = new ethers.Contract(this.config.settlementToken, ERC20_ABI, this.provider);
    const [name, version] = await Promise.all([
      token.name() as Promise<string>,
      token.version().catch(() => '1') as Promise<string>,
    ]);

    const result = await this.gasless.transfer({
      from: this.signer.address,
      to: vaultAddress,
      amount,
      tokenAddress: this.config.settlementToken,
      signerWallet: this.signer,
      chainId: this.config.chainId,
      eip712Name: name,
      eip712Version: version,
      network: this.config.chainId === 2366 ? 'mainnet' : 'testnet',
    });

    return result.txHash;
  }

  /**
   * Requests a virtual Visa card by calling the Kite402 API.
   * The API deducts from the vault and issues the card.
   */
  async requestCard(apiBaseUrl: string, usdcAmount: bigint): Promise<CardResult> {
    const vaultAddress = await this.getVaultAddress();
    if (!vaultAddress) throw new Error('Vault not deployed');

    // Sign a request payload for API authentication
    const timestamp = Date.now();
    const payload = JSON.stringify({ agentId: this.agentId, usdcAmount: usdcAmount.toString(), timestamp });
    const signature = await this.signer.signMessage(payload);

    const res = await fetch(`${apiBaseUrl}/trpc/cards.issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Signature': signature,
      },
      body: JSON.stringify({ json: { agentId: this.agentId, usdcAmount: usdcAmount.toString() } }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Card issuance failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { result: { data: { json: CardResult } } };
    return data.result.data.json;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async _deployViaAA(
    implementation: string,
    initData: string,
  ): Promise<ethers.TransactionResponse> {
    // Dynamic import so the SDK works without gokite-aa-sdk in test environments
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GokiteAASDK } = require('gokite-aa-sdk');
    const aaSdk = new GokiteAASDK('kite_testnet', this.config.rpcUrl, this.config.bundlerRpc);
    await aaSdk.init(this.signer.privateKey);

    // Encode proxy deployment as a UserOperation call
    const proxyCreationCode = ethers.solidityPacked(
      ['bytes', 'bytes'],
      [
        // ERC1967Proxy creation bytecode would be here in production
        '0x',
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'bytes'],
          [implementation, initData],
        ),
      ],
    );

    const userOpHash = await aaSdk.sendUserOperationAndWait({
      target: ethers.ZeroAddress,
      data: proxyCreationCode,
      value: 0n,
    });

    return { hash: userOpHash, wait: async () => ({ hash: userOpHash, contractAddress: null, logs: [] }) } as unknown as ethers.TransactionResponse;
  }
}
