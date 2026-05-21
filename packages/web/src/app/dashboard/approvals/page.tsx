'use client';

import { trpc } from '../../providers';
import { USDCAmount } from '../../../components/ui/USDCAmount';
import { Skeleton } from '../../../components/ui/Skeleton';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function ApprovalsPage() {
  const utils = trpc.useUtils();
  const { data: approvals, isLoading } = trpc.approvals.list.useQuery(undefined, {
    refetchInterval: 5000, // poll every 5s
  });

  const approveMutation = trpc.approvals.approve.useMutation({
    onSuccess: () => utils.approvals.list.invalidate(),
  });
  const rejectMutation = trpc.approvals.reject.useMutation({
    onSuccess: () => utils.approvals.list.invalidate(),
  });

  const pending = approvals?.filter((a) => a.status === 'PENDING') ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Approval Queue</h1>
          <p className="text-kite-muted text-sm mt-0.5">
            Requests above the auto-approval threshold require manual sign-off
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-kite-muted">Live — polling every 5s</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : pending.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle size={32} className="mx-auto text-green-400 mb-3" />
          <p className="text-slate-200 font-medium">All clear</p>
          <p className="text-kite-muted text-sm mt-1">No pending approvals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((item) => {
            const isApproving = approveMutation.isPending && approveMutation.variables?.queueId === item.id;
            const isRejecting = rejectMutation.isPending && rejectMutation.variables?.queueId === item.id;

            return (
              <div key={item.id} className="card flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{item.agent.name}</span>
                    <span className="text-kite-muted text-xs">·</span>
                    <span className="text-kite-muted text-xs">{item.agent.groupName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <USDCAmount amount={item.usdcAmount} className="text-lg font-bold" />
                    {item.merchantHint && (
                      <span className="text-kite-muted text-xs bg-kite-border px-2 py-0.5 rounded">
                        {item.merchantHint}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-kite-muted">
                    <Clock size={11} />
                    <span>{timeAgo(item.requestedAt)}</span>
                    <span>·</span>
                    <span className="font-mono">{item.agent.agentId.slice(0, 10)}…</span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => rejectMutation.mutate({ queueId: item.id })}
                    disabled={isRejecting || isApproving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md
                               border border-red-500/20 text-red-400 hover:bg-red-500/10
                               transition-colors disabled:opacity-50"
                  >
                    <XCircle size={12} />
                    {isRejecting ? 'Rejecting…' : 'Reject'}
                  </button>
                  <button
                    onClick={() => approveMutation.mutate({ queueId: item.id })}
                    disabled={isApproving || isRejecting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md
                               bg-green-500/10 border border-green-500/20 text-green-400
                               hover:bg-green-500/20 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle size={12} />
                    {isApproving ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
