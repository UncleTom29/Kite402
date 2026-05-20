import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ethers } from 'ethers';
import { router, protectedProcedure } from '../lib/trpc';
import { prisma } from '../lib/prisma';
import { KiteAgentWallet, defaultPolicy } from '@kite402/sdk';
import { getKiteConfig } from '../lib/kite-config';

const SpendPolicySchema = z.object({
  perOrderLimit: z.bigint().positive(),
  dailyLimit: z.bigint().positive(),
  lifetimeLimit: z.bigint().positive(),
});

export const agentsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(64),
        groupName: z.string().min(1).max(64),
        policy: SpendPolicySchema,
        webhookUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const agentId = ethers.id(`${ctx.operatorId}-${input.name}-${Date.now()}`);

      const agent = await prisma.agent.create({
        data: {
          operatorId: ctx.operatorId,
          agentId,
          name: input.name,
          groupName: input.groupName,
          status: 'PENDING',
          policyPerOrder: input.policy.perOrderLimit,
          policyDaily: input.policy.dailyLimit,
          policyLifetime: input.policy.lifetimeLimit,
        },
      });

      // Deploy vault asynchronously — status updates in background
      setImmediate(async () => {
        try {
          const config = getKiteConfig();
          const wallet = new KiteAgentWallet(agentId, process.env.DEPLOYER_PRIVATE_KEY!, config);
          const { vaultAddress, txHash } = await wallet.deployVault({
            perOrderLimit: input.policy.perOrderLimit,
            dailyLimit: input.policy.dailyLimit,
            lifetimeLimit: input.policy.lifetimeLimit,
          });

          await prisma.agent.update({
            where: { id: agent.id },
            data: { vaultAddress, status: 'ACTIVE' },
          });

          await prisma.auditLog.create({
            data: {
              operatorId: ctx.operatorId,
              agentId: agent.id,
              action: 'AGENT_CREATED',
              metadata: { vaultAddress, txHash },
              ip: ctx.ip,
              userAgent: ctx.userAgent,
            },
          });
        } catch (err) {
          console.error('[agents.create] vault deployment failed:', err);
          await prisma.agent.update({
            where: { id: agent.id },
            data: { status: 'SUSPENDED' },
          });
        }
      });

      return agent;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const agents = await prisma.agent.findMany({
      where: { operatorId: ctx.operatorId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { cards: true } } },
    });

    return agents;
  }),

  get: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input, ctx }) => {
      const agent = await prisma.agent.findFirst({
        where: { id: input.agentId, operatorId: ctx.operatorId },
        include: {
          cards: { orderBy: { issuedAt: 'desc' }, take: 20 },
          auditLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
        },
      });

      if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      return agent;
    }),

  suspend: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const agent = await prisma.agent.findFirst({
        where: { id: input.agentId, operatorId: ctx.operatorId },
      });
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });

      // Suspend on-chain
      if (agent.vaultAddress) {
        try {
          const config = getKiteConfig();
          const provider = new ethers.JsonRpcProvider(config.rpcUrl);
          const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
          const vault = new ethers.Contract(
            agent.vaultAddress,
            ['function suspend()'],
            signer,
          );
          await (await vault.suspend()).wait();
        } catch (err) {
          console.error('[agents.suspend] on-chain suspend failed:', err);
        }
      }

      await prisma.agent.update({ where: { id: agent.id }, data: { status: 'SUSPENDED' } });

      await prisma.auditLog.create({
        data: {
          operatorId: ctx.operatorId,
          agentId: agent.id,
          action: 'AGENT_SUSPENDED',
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });

      return { success: true };
    }),

  resume: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const agent = await prisma.agent.findFirst({
        where: { id: input.agentId, operatorId: ctx.operatorId },
      });
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });

      if (agent.vaultAddress) {
        try {
          const config = getKiteConfig();
          const provider = new ethers.JsonRpcProvider(config.rpcUrl);
          const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
          const vault = new ethers.Contract(
            agent.vaultAddress,
            ['function resume()'],
            signer,
          );
          await (await vault.resume()).wait();
        } catch (err) {
          console.error('[agents.resume] on-chain resume failed:', err);
        }
      }

      await prisma.agent.update({ where: { id: agent.id }, data: { status: 'ACTIVE' } });
      return { success: true };
    }),

  updatePolicy: protectedProcedure
    .input(z.object({ agentId: z.string(), policy: SpendPolicySchema }))
    .mutation(async ({ input, ctx }) => {
      const agent = await prisma.agent.findFirst({
        where: { id: input.agentId, operatorId: ctx.operatorId },
      });
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });

      if (agent.vaultAddress) {
        try {
          const { encodeConfigurePolicy } = await import('@kite402/sdk');
          const config = getKiteConfig();
          const provider = new ethers.JsonRpcProvider(config.rpcUrl);
          const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
          const vault = new ethers.Contract(
            agent.vaultAddress,
            ['function configurePolicy((uint256,uint256,uint256,uint256,uint256,uint256,bool))'],
            signer,
          );
          const calldata = encodeConfigurePolicy(input.policy);
          await (await signer.sendTransaction({ to: agent.vaultAddress, data: calldata })).wait();
        } catch (err) {
          console.error('[agents.updatePolicy] on-chain update failed:', err);
        }
      }

      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          policyPerOrder: input.policy.perOrderLimit,
          policyDaily: input.policy.dailyLimit,
          policyLifetime: input.policy.lifetimeLimit,
        },
      });

      await prisma.auditLog.create({
        data: {
          operatorId: ctx.operatorId,
          agentId: agent.id,
          action: 'POLICY_UPDATED',
          metadata: {
            perOrderLimit: input.policy.perOrderLimit.toString(),
            dailyLimit: input.policy.dailyLimit.toString(),
            lifetimeLimit: input.policy.lifetimeLimit.toString(),
          },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });

      return { success: true };
    }),
});
