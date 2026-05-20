import { ethers } from 'ethers';
import type { GaslessToken, GaslessTransferResult } from './types';

const DEFAULT_GASLESS_ENDPOINT = 'https://gasless.gokite.ai';

// EIP-3009 TransferWithAuthorization type hash
const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)',
  ),
);

export interface GaslessTransferParams {
  from: string;
  to: string;
  amount: bigint;
  tokenAddress: string;
  signerWallet: ethers.Wallet;
  chainId: number;
  eip712Name: string;
  eip712Version: string;
  network?: 'testnet' | 'mainnet';
  gaslessEndpoint?: string;
}

export class GaslessTransfer {
  private readonly endpoint: string;

  constructor(endpoint: string = DEFAULT_GASLESS_ENDPOINT) {
    this.endpoint = endpoint;
  }

  /**
   * Returns tokens supported by the Kite Gasless endpoint.
   */
  async getSupportedTokens(): Promise<GaslessToken[]> {
    const res = await fetch(`${this.endpoint}/supported_tokens`);
    if (!res.ok) throw new Error(`Failed to fetch supported tokens: ${res.statusText}`);
    return res.json() as Promise<GaslessToken[]>;
  }

  /**
   * Submits a gasless EIP-3009 transferWithAuthorization transaction.
   */
  async transfer(params: GaslessTransferParams): Promise<GaslessTransferResult> {
    const {
      from,
      to,
      amount,
      tokenAddress,
      signerWallet,
      chainId,
      eip712Name,
      eip712Version,
      network = 'testnet',
      gaslessEndpoint,
    } = params;

    const endpoint = gaslessEndpoint ?? this.endpoint;

    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const now = Math.floor(Date.now() / 1000);
    const validAfter = now - 5;
    const validBefore = now + 25;

    const domain: ethers.TypedDataDomain = {
      name: eip712Name,
      version: eip712Version,
      chainId,
      verifyingContract: tokenAddress,
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    const value = {
      from,
      to,
      value: amount,
      validAfter,
      validBefore,
      nonce,
    };

    const signature = await signerWallet.signTypedData(domain, types, value);
    const { v, r, s } = ethers.Signature.from(signature);

    const body = {
      from,
      to,
      value: amount.toString(),
      validAfter,
      validBefore,
      nonce,
      v,
      r,
      s,
      token: tokenAddress,
    };

    const res = await fetch(`${endpoint}/${network}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gasless transfer failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<GaslessTransferResult>;
  }
}
