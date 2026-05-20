import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ethers } from 'ethers';
import { router, protectedProcedure } from '../lib/trpc';
import { prisma } from '../lib/prisma';
import { issueVirtualCard, revokeCard } from '../lib/card-issuer';
import { hashCard, attest, revokeAttestation } from '@kite402/sdk';
import { getKiteConfig } from '../lib/kite-config';

const APPROVAL_THRESHOLD = BigInt(process.env.CARD_APPROVAL_THRESHOLD_CENTS ?? 1000) * 10_000n;
// convert cents to USDC 6-decimal: cents * 10^4 = micro-USDC

export const cardsRouter = router({
  issue: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        usdcAmount: z.bigint().positive(),
        merchantHint: z.string().optional(),
        webhookUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const agent = await prisma.agent.findFirst({
        where: { id: input.agentId, operatorId: ctx.operatorId },
      });
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      if (agent.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Agent is not active' });
      }
      if (input.usdcAmount > agent.policyPerOrder) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Amount exceeds per-order limit' });
      }

      // Requires approval for large amounts
      if (input.usdcAmount > APPROVAL_THRESHOLD) {
        const queue = await prisma.approvalQueue.create({
          data: {
            agentId: agent.id,
            operatorId: ctx.operatorId,
            usdcAmount: input.usdcAmount,
            merchantHint: input.merchantHint,
            webhookUrl: input.webhookUrl,
            status: 'PENDING',
          },
        });

        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Approval required',
          cause: { approvalQueueId: queue.id },
        });
      }

      return _issueCard(agent, input.usdcAmount, ctx.operatorId, ctx.ip, ctx.userAgent);
    }),

  list: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input, ctx }) => {
      const agent = await prisma.agent.findFirst({
        where: { id: input.agentId, operatorId: ctx.operatorId },
      });
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });

      return prisma.card.findMany({
        where: { agentId: agent.id },
        orderBy: { issuedAt: 'desc' },
        select: {
          id: true,
          agentId: true,
          usdcAmount: true,
          attestationId: true,
          issuedAt: true,
          revokedAt: true,
          txHash: true,
          // cardHash exposed for verification — never raw PAN
          cardHash: true,
        },
      });
    }),

  revoke: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const card = await prisma.card.findFirst({
        where: { id: input.cardId },
        include: { agent: true },
      });
      if (!card || card.agent.operatorId !== ctx.operatorId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Card not found' });
      }
      if (card.revokedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Card already revoked' });
      }

      // Revoke at card issuer
      try {
        await revokeCard(card.id);
      } catch (err) {
        console.error('[cards.revoke] issuer revocation failed:', err);
      }

      // Revoke on-chain attestation
      try {
        const config = getKiteConfig();
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
        await revokeAttestation(config.attestationAddress, card.attestationId, signer);
      } catch (err) {
        console.error('[cards.revoke] on-chain revocation failed:', err);
      }

      await prisma.card.update({
        where: { id: card.id },
        data: { revokedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          operatorId: ctx.operatorId,
          agentId: card.agentId,
          action: 'CARD_REVOKED',
          metadata: { cardId: card.id, attestationId: card.attestationId },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });

      return { success: true };
    }),
});

// Shared card issuance logic (also called from approvals.approve)
export async function _issueCard(
  agent: { id: string; vaultAddress: string | null; operatorId: string },
  usdcAmount: bigint,
  operatorId: string,
  ip: string,
  userAgent: string,
) {
  // Issue from card provider
  const usdcCents = Number(usdcAmount / 10_000n); // convert micro-USDC to cents
  const issued = await issueVirtualCard(usdcCents);

  // Hash the card — never persist raw PAN
  const cardHashHex = hashCard(issued.pan, issued.expiry);

  // On-chain attestation
  let attestationId = '0x' + '0'.repeat(64);
  let txHash: string | null = null;
  try {
    const config = getKiteConfig();
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
    attestationId = await attest(
      config.attestationAddress,
      agent.id,
      usdcAmount,
      cardHashHex,
      signer,
    );
    txHash = attestationId;
  } catch (err) {
    console.error('[_issueCard] attestation failed:', err);
  }

  // Deduct from vault
  if (agent.vaultAddress) {
    try {
      const config = getKiteConfig();
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
      const vault = new ethers.Contract(
        agent.vaultAddress,
        ['function withdraw(address to, uint256 amount)'],
        signer,
      );
      await (await vault.withdraw(signer.address, usdcAmount)).wait();
    } catch (err) {
      console.error('[_issueCard] vault withdrawal failed:', err);
    }
  }

  const card = await prisma.card.create({
    data: {
      agentId: agent.id,
      usdcAmount,
      attestationId,
      cardHash: cardHashHex,
      txHash,
    },
  });

  await prisma.agent.update({
    where: { id: agent.id },
    data: { totalSpent: { increment: usdcAmount } },
  });

  await prisma.auditLog.create({
    data: {
      operatorId,
      agentId: agent.id,
      action: 'CARD_ISSUED',
      metadata: { cardId: card.id, usdcAmount: usdcAmount.toString(), attestationId },
      ip,
      userAgent,
    },
  });

  return {
    pan: issued.pan,
    cvv: issued.cvv,
    expiry: issued.expiry,
    expiresIn: 60,
    attestationId,
    txHash: txHash ?? '',
    cardId: card.id,
  };
}
