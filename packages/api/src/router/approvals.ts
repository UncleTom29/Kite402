import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../lib/trpc';
import { prisma } from '../lib/prisma';
import { _issueCard } from './cards';
import { sendWebhook } from '../webhooks/sender';

export const approvalsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.approvalQueue.findMany({
      where: { operatorId: ctx.operatorId, status: 'PENDING' },
      include: { agent: { select: { name: true, groupName: true, agentId: true } } },
      orderBy: { requestedAt: 'asc' },
    });
  }),

  approve: protectedProcedure
    .input(z.object({ queueId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const item = await prisma.approvalQueue.findFirst({
        where: { id: input.queueId, operatorId: ctx.operatorId, status: 'PENDING' },
        include: { agent: true },
      });
      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Approval item not found' });

      await prisma.approvalQueue.update({
        where: { id: item.id },
        data: { status: 'APPROVED', resolvedAt: new Date() },
      });

      // Issue the card now that it's approved
      const result = await _issueCard(
        item.agent,
        item.usdcAmount,
        ctx.operatorId,
        ctx.ip,
        ctx.userAgent,
      );

      // Notify agent webhook
      if (item.webhookUrl) {
        await sendWebhook(item.webhookUrl, {
          event: 'approval.resolved',
          queueId: item.id,
          status: 'APPROVED',
          agentId: item.agent.agentId,
          cardId: result.cardId,
          timestamp: Date.now(),
        });
      }

      return result;
    }),

  reject: protectedProcedure
    .input(z.object({ queueId: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const item = await prisma.approvalQueue.findFirst({
        where: { id: input.queueId, operatorId: ctx.operatorId, status: 'PENDING' },
        include: { agent: true },
      });
      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Approval item not found' });

      await prisma.approvalQueue.update({
        where: { id: item.id },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      });

      if (item.webhookUrl) {
        await sendWebhook(item.webhookUrl, {
          event: 'approval.resolved',
          queueId: item.id,
          status: 'REJECTED',
          agentId: item.agent.agentId,
          reason: input.reason,
          timestamp: Date.now(),
        });
      }

      await prisma.auditLog.create({
        data: {
          operatorId: ctx.operatorId,
          agentId: item.agentId,
          action: 'APPROVAL_REJECTED',
          metadata: { queueId: item.id, reason: input.reason },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });

      return { success: true };
    }),
});
