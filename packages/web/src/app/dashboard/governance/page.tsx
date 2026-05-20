'use client';

import { useState } from 'react';
import { trpc } from '../../providers';
import { Skeleton } from '../../../components/ui/Skeleton';
import { KiteScanLink } from '../../../components/ui/KiteScanLink';
import { Shield, Clock, CheckCircle, XCircle, PlayCircle } from 'lucide-react';

export default function GovernancePage() {
  const utils = trpc.useUtils();
  const { data: proposals, isLoading } = trpc.governance.listPending.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  const approveMutation = trpc.governance.approveAction.useMutation({
    onSuccess: () => utils.governance.listPending.invalidate(),
  });
  const executeMutation = trpc.governance.executeAction.useMutation({
    onSuccess: () => utils.governance.listPending.invalidate(),
  });

  const [showPropose, setShowPropose] = useState(false);
  const [proposalTarget, setProposalTarget] = useState('');
  const [proposalCalldata, setProposalCalldata] = useState('');
  const [proposalDesc, setProposalDesc] = useState('');

  const proposeMutation = trpc.governance.proposeAction.useMutation({
    onSuccess: () => {
      utils.governance.listPending.invalidate();
      setShowPropose(false);
      setProposalTarget('');
      setProposalCalldata('');
      setProposalDesc('');
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Shield size={18} className="text-kite-blue" />
            Multisig Governance
          </h1>
          <p className="text-kite-muted text-sm mt-0.5">
            Fleet-level actions requiring M-of-N signer approval
          </p>
        </div>
        <button onClick={() => setShowPropose(!showPropose)} className="btn-primary text-sm">
          + Propose Action
        </button>
      </div>

      {showPropose && (
        <div className="card mb-6 space-y-3">
          <h3 className="text-sm font-medium">New Proposal</h3>
          <div>
            <label className="block text-xs text-kite-muted mb-1">Target Contract</label>
            <input
              className="input"
              placeholder="0x..."
              value={proposalTarget}
              onChange={(e) => setProposalTarget(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-kite-muted mb-1">Calldata (hex)</label>
            <input
              className="input font-mono"
              placeholder="0x..."
              value={proposalCalldata}
              onChange={(e) => setProposalCalldata(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-kite-muted mb-1">Description</label>
            <input
              className="input"
              placeholder="Describe this action..."
              value={proposalDesc}
              onChange={(e) => setProposalDesc(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                proposeMutation.mutate({
                  target: proposalTarget,
                  calldata: proposalCalldata,
                  description: proposalDesc,
                })
              }
              disabled={proposeMutation.isPending}
              className="btn-primary text-xs"
            >
              {proposeMutation.isPending ? 'Proposing…' : 'Submit Proposal'}
            </button>
            <button onClick={() => setShowPropose(false)} className="btn-ghost text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : proposals?.length === 0 ? (
        <div className="card text-center py-16">
          <Shield size={32} className="mx-auto text-kite-muted mb-3" />
          <p className="text-slate-200 font-medium">No pending proposals</p>
          <p className="text-kite-muted text-sm mt-1">Propose an action above to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals?.map((p) => {
            const timelockMs = p.executeAfter !== '0'
              ? Math.max(0, Number(p.executeAfter) * 1000 - Date.now())
              : 0;
            const timelockHours = Math.ceil(timelockMs / 3600000);
            const ready = p.approvalCount >= p.threshold && timelockMs === 0;

            return (
              <div key={p.id} className="card space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{p.description}</p>
                    <p className="text-kite-muted text-xs font-mono mt-0.5">
                      Target: {p.target.slice(0, 10)}…{p.target.slice(-6)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-kite-muted">
                      {p.approvalCount}/{p.threshold} approvals
                    </span>
                    {timelockHours > 0 && (
                      <span className="flex items-center gap-1 text-amber-400 text-xs">
                        <Clock size={11} />
                        {timelockHours}h timelock
                      </span>
                    )}
                  </div>
                </div>

                {/* Signer approval list */}
                <div className="flex gap-2 flex-wrap">
                  {p.approvals.map(({ signer, approved }) => (
                    <span
                      key={signer}
                      className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                        approved
                          ? 'bg-green-500/10 border-green-500/20 text-green-400'
                          : 'bg-kite-border/40 border-kite-border text-kite-muted'
                      }`}
                    >
                      {approved ? <CheckCircle size={10} /> : <XCircle size={10} />}
                      {signer.slice(0, 8)}…
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-1 border-t border-kite-border">
                  <button
                    onClick={() => approveMutation.mutate({ proposalId: p.id })}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 text-xs btn-ghost"
                  >
                    <CheckCircle size={11} />
                    Approve
                  </button>
                  {ready && (
                    <button
                      onClick={() => executeMutation.mutate({ proposalId: p.id })}
                      disabled={executeMutation.isPending}
                      className="flex items-center gap-1.5 text-xs btn-primary"
                    >
                      <PlayCircle size={11} />
                      {executeMutation.isPending ? 'Executing…' : 'Execute'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
