import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { prisma } from '../lib/prisma';

export const auditRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        agentId: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input, ctx }) => {
      const where = {
        operatorId: ctx.operatorId,
        ...(input.agentId && { agentId: input.agentId }),
        ...(input.startDate || input.endDate
          ? {
              createdAt: {
                ...(input.startDate && { gte: input.startDate }),
                ...(input.endDate && { lte: input.endDate }),
              },
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.perPage,
          take: input.perPage,
          include: { agent: { select: { name: true, agentId: true } } },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return {
        items,
        total,
        page: input.page,
        perPage: input.perPage,
        totalPages: Math.ceil(total / input.perPage),
      };
    }),
});
