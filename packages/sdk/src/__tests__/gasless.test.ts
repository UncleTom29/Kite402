import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { GaslessTransfer } from '../gasless';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GaslessTransfer', () => {
  const gasless = new GaslessTransfer('https://gasless.gokite.ai');
  const wallet = ethers.Wallet.createRandom();

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('getSupportedTokens()', () => {
    it('fetches supported tokens', async () => {
      const tokens = [{ address: '0x123', symbol: 'USDC.e', decimals: 6 }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokens),
      });

      const result = await gasless.getSupportedTokens();
      expect(result).toEqual(tokens);
      expect(mockFetch).toHaveBeenCalledWith('https://gasless.gokite.ai/supported_tokens');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Not Found' });
      await expect(gasless.getSupportedTokens()).rejects.toThrow('Not Found');
    });
  });

  describe('transfer()', () => {
    it('builds EIP-3009 signature and POSTs to gasless endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ txHash: '0xabc' }),
      });

      const result = await gasless.transfer({
        from: wallet.address,
        to: '0x' + '1'.repeat(40),
        amount: 100n * 10n ** 6n,
        tokenAddress: '0x' + '2'.repeat(40),
        signerWallet: wallet,
        chainId: 2368,
        eip712Name: 'USD Coin',
        eip712Version: '2',
        network: 'testnet',
      });

      expect(result.txHash).toBe('0xabc');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://gasless.gokite.ai/testnet',
        expect.objectContaining({ method: 'POST' }),
      );

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.from).toBe(wallet.address);
      expect(body.value).toBe('100000000');
      expect(typeof body.nonce).toBe('string');
      expect(body.nonce).toMatch(/^0x[0-9a-f]{64}$/i);
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('bad request'),
      });

      await expect(
        gasless.transfer({
          from: wallet.address,
          to: '0x' + '1'.repeat(40),
          amount: 10n,
          tokenAddress: '0x' + '2'.repeat(40),
          signerWallet: wallet,
          chainId: 2368,
          eip712Name: 'USD Coin',
          eip712Version: '2',
        }),
      ).rejects.toThrow('bad request');
    });
  });
});
