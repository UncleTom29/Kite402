import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ethers } from 'ethers';
import { router, protectedProcedure } from '../lib/trpc';
import { getKiteConfig } from '../lib/kite-config';

const MULTISIG_ABI = [
  'function proposeAction(address target, bytes calldata callData, string calldata description) returns (uint256)',
  'function approveAction(uint256 proposalId)',
  'function revokeApproval(uint256 proposalId)',
  'function executeAction(uint256 proposalId)',
  'function getProposal(uint256 proposalId) view returns (address target, string description, uint256 proposedAt, uint256 executeAfter, uint256 approvalCount, bool executed, bool cancelled)',
  'function hasApproved(uint256 proposalId, address signer) view returns (bool)',
  'function proposalCount() view returns (uint256)',
  'function threshold() view returns (uint256)',
  'function getSigners() view returns (address[])',
  'event ActionProposed(uint256 indexed proposalId, address indexed proposer, address target, string description)',
];

function getMultisig(signer: ethers.Signer) {
  const address = process.env.MULTISIG_OPERATOR_ADDRESS;
  if (!address) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Multisig not configured' });
  return new ethers.Contract(address, MULTISIG_ABI, signer);
}

function getSigner() {
  const config = getKiteConfig();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  return new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
}

export const governanceRouter = router({
  proposeAction: protectedProcedure
    .input(
      z.object({
        target: z.string(),
        calldata: z.string(),
        description: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const signer = getSigner();
      const multisig = getMultisig(signer);
      const tx = await multisig.proposeAction(input.target, input.calldata, input.description);
      const receipt = await tx.wait();

      // Parse proposalId from event
      let proposalId = '0';
      for (const log of receipt.logs) {
        try {
          const parsed = multisig.interface.parseLog(log);
          if (parsed?.name === 'ActionProposed') {
            proposalId = parsed.args.proposalId.toString();
          }
        } catch {}
      }
      return { proposalId, txHash: receipt.hash };
    }),

  approveAction: protectedProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input }) => {
      const signer = getSigner();
      const multisig = getMultisig(signer);
      const tx = await multisig.approveAction(BigInt(input.proposalId));
      const receipt = await tx.wait();
      return { success: true, txHash: receipt.hash };
    }),

  revokeApproval: protectedProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input }) => {
      const signer = getSigner();
      const multisig = getMultisig(signer);
      const tx = await multisig.revokeApproval(BigInt(input.proposalId));
      await tx.wait();
      return { success: true };
    }),

  executeAction: protectedProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input }) => {
      const signer = getSigner();
      const multisig = getMultisig(signer);
      const tx = await multisig.executeAction(BigInt(input.proposalId));
      const receipt = await tx.wait();
      return { success: true, txHash: receipt.hash };
    }),

  listPending: protectedProcedure.query(async () => {
    const signer = getSigner();
    const multisig = getMultisig(signer);

    const count = Number(await multisig.proposalCount());
    const signers = await multisig.getSigners() as string[];
    const threshold = Number(await multisig.threshold());

    const proposals = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        multisig.getProposal(i).then(async (p: [string, string, bigint, bigint, bigint, boolean, boolean]) => {
          const approvals = await Promise.all(
            signers.map((s: string) => multisig.hasApproved(i, s).then((v: boolean) => ({ signer: s, approved: v }))),
          );
          return {
            id: i.toString(),
            target: p[0],
            description: p[1],
            proposedAt: p[2].toString(),
            executeAfter: p[3].toString(),
            approvalCount: Number(p[4]),
            executed: p[5],
            cancelled: p[6],
            threshold,
            approvals,
          };
        }),
      ),
    );

    return proposals.filter((p) => !p.executed && !p.cancelled);
  }),
});
