import type { Request, Response, NextFunction } from 'express';
import { PassportServiceProvider } from '@kite402/sdk';
import type { PassportSession } from '@kite402/sdk';

declare global {
  namespace Express {
    interface Request {
      passportSession?: PassportSession;
    }
  }
}

const passportProvider = new PassportServiceProvider({
  serviceName: process.env.PASSPORT_SERVICE_NAME ?? 'kite402-card-issuance',
  serviceDescription: 'Issue virtual Visa cards for AI agents via x402 protocol',
  pricePerCall: BigInt(process.env.PASSPORT_PRICE_PER_CALL ?? '1000000'), // 1 USDC
  webhookUrl: process.env.PASSPORT_WEBHOOK_URL ?? '',
  kiteWalletAddress: process.env.KITE_WALLET_ADDRESS ?? '',
});

/**
 * Validates X-Kite-Passport-Session header and attaches session to request.
 * Falls back to standard JWT auth if no passport session is present.
 */
export async function passportAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionToken = req.headers['x-kite-passport-session'] as string | undefined;
  if (!sessionToken) {
    next();
    return;
  }

  try {
    const session = await passportProvider.verifySession(sessionToken);
    req.passportSession = session;

    // Inject operatorId-like context so downstream tRPC procedures work
    if (!req.operator) {
      (req as Request & { operator: { sub: string; email: string } }).operator = {
        sub: `passport:${session.agentId}`,
        email: `agent:${session.agentId}`,
      };
    }

    next();
  } catch (err) {
    next(err);
  }
}

export { passportProvider };
