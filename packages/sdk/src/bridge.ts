import { ethers } from 'ethers';

const BRIDGE_SENDER_ABI = [
  'function quoteBridge(bytes32 agentId, uint256 amount, address recipient) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee))',
  'function bridge(bytes32 agentId, uint256 amount, address recipient) payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))',
];

const ERC20_APPROVE_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
];

export interface BridgeParams {
  agentId: string;
  amount: bigint;
  recipient: string;   // AgentVault address on Kite chain
  signer: ethers.Signer;
  bridgeSenderAddress: string;
  usdcAddress: string;
}

export interface BridgeResult {
  guid: string;
  txHash: string;
  nativeFeeUsed: bigint;
}

/**
 * Bridge USDC from Ethereum Sepolia to Kite chain via LayerZero V2.
 */
export async function bridgeFromEthereum(params: BridgeParams): Promise<BridgeResult> {
  return _bridge(params);
}

/**
 * Bridge USDC from Base Sepolia to Kite chain via LayerZero V2.
 */
export async function bridgeFromBase(params: BridgeParams): Promise<BridgeResult> {
  return _bridge(params);
}

/**
 * Estimate the native fee for a cross-chain bridge operation.
 */
export async function estimateBridgeFee(
  bridgeSenderAddress: string,
  agentId: string,
  amount: bigint,
  recipient: string,
  provider: ethers.Provider,
): Promise<bigint> {
  const sender = new ethers.Contract(bridgeSenderAddress, BRIDGE_SENDER_ABI, provider);
  const fee = await sender.quoteBridge(agentId, amount, recipient);
  return fee.nativeFee as bigint;
}

async function _bridge(params: BridgeParams): Promise<BridgeResult> {
  const { agentId, amount, recipient, signer, bridgeSenderAddress, usdcAddress } = params;

  // Approve BridgeSender to spend USDC
  const usdc = new ethers.Contract(usdcAddress, ERC20_APPROVE_ABI, signer);
  await (await usdc.approve(bridgeSenderAddress, amount)).wait();

  const sender = new ethers.Contract(bridgeSenderAddress, BRIDGE_SENDER_ABI, signer);

  // Quote fee
  const fee = await sender.quoteBridge(agentId, amount, recipient);
  const nativeFee: bigint = fee.nativeFee;

  const tx = await sender.bridge(agentId, amount, recipient, { value: nativeFee });
  const receipt = await tx.wait();

  // Extract guid from BridgeInitiated event
  const iface = new ethers.Interface(BRIDGE_SENDER_ABI);
  let guid = ethers.ZeroHash;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'BridgeInitiated') {
        guid = parsed.args.guid as string;
        break;
      }
    } catch {
      // not our log
    }
  }

  return { guid, txHash: receipt.hash, nativeFeeUsed: nativeFee };
}
