import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { router, publicProcedure } from '../lib/trpc';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.operator.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      const operator = await prisma.operator.create({
        data: { email: input.email, passwordHash },
      });

      const token = signToken({ sub: operator.id, email: operator.email });
      return { token, operatorId: operator.id, email: operator.email };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const operator = await prisma.operator.findUnique({ where: { email: input.email } });
      if (!operator) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(input.password, operator.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
      }

      const token = signToken({ sub: operator.id, email: operator.email });
      return { token, operatorId: operator.id, email: operator.email };
    }),
});
