import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { JwtPayload } from '../middleware/auth';
import jwt from 'jsonwebtoken';

export interface Context {
  operatorId: string | null;
  operatorEmail: string | null;
  ip: string;
  userAgent: string;
}

const JWT_SECRET = process.env.JWT_SECRET;

function parseOperator(req: CreateExpressContextOptions['req']): JwtPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || !JWT_SECRET) return null;

  const token = authHeader.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function createContext({ req }: CreateExpressContextOptions): Context {
  const payload = parseOperator(req);
  return {
    operatorId: payload?.sub ?? null,
    operatorEmail: payload?.email ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.operatorId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({ ctx: { ...ctx, operatorId: ctx.operatorId } });
});
