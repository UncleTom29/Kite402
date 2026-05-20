import { ethers } from 'ethers';
import type { PassportServiceConfig, PassportSession } from './types';

/**
 * PassportServiceProvider — integrates with Kite Agent Passport to register
 * Kite402 as a discoverable service and validate inbound agent sessions.
 */
export class PassportServiceProvider {
  private readonly config: PassportServiceConfig;
  private registrationId: string | null = null;

  constructor(config: PassportServiceConfig) {
    this.config = config;
  }

  /**
   * Registers Kite402 card issuance as a Passport-discoverable service.
   * Must be called once during server startup.
   */
  async register(): Promise<string> {
    const body = {
      serviceName: this.config.serviceName,
      serviceDescription: this.config.serviceDescription,
      pricePerCall: this.config.pricePerCall.toString(),
      webhookUrl: this.config.webhookUrl,
      walletAddress: this.config.kiteWalletAddress,
    };

    const res = await fetch('https://passport.gokite.ai/api/v1/services/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Passport registration failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { registrationId: string };
    this.registrationId = data.registrationId;
    return this.registrationId;
  }

  /**
   * Validates an inbound Kite Agent Passport session token.
   * Returns the session details including approved budget.
   */
  async verifySession(sessionToken: string): Promise<PassportSession> {
    const res = await fetch('https://passport.gokite.ai/api/v1/sessions/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Session verification failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      agentId: string;
      budget: string;
      expiresAt: number;
      spentSoFar: string;
    };

    return {
      sessionToken,
      agentId: data.agentId,
      budget: BigInt(data.budget),
      expiresAt: data.expiresAt,
      spentSoFar: BigInt(data.spentSoFar),
    };
  }

  /**
   * Charges the session for a service call.
   */
  async chargeSession(sessionToken: string, amount: bigint): Promise<void> {
    const res = await fetch('https://passport.gokite.ai/api/v1/sessions/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken, amount: amount.toString() }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Session charge failed (${res.status}): ${err}`);
    }
  }
}

/**
 * Generates a HMAC-SHA256 signature for outbound webhook payloads.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  // In Node.js environment
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
