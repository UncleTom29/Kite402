'use client';

import { trpc } from '../providers';
import { StatusChip } from '../../components/ui/StatusChip';
import { USDCAmount } from '../../components/ui/USDCAmount';
import { KiteScanLink } from '../../components/ui/KiteScanLink';
import { CopyButton } from '../../components/ui/CopyButton';
import { SkeletonTable, Skeleton } from '../../components/ui/Skeleton';
import Link from 'next/link';
import { Plus, RefreshCw } from 'lucide-react';

export default function FleetOverviewPage() {
  const { data: agents, isLoading, refetch } = trpc.agents.list.useQuery();

  const suspendMutation = trpc.agents.suspend.useMutation({
    onSuccess: () => refetch(),
  });
  const resumeMutation = trpc.agents.resume.useMutation({
    onSuccess: () => refetch(),
  });

  // KPI calculations
  const totalAgents = agents?.length ?? 0;
  const activeAgents = agents?.filter((a) => a.status === 'ACTIVE').length ?? 0;
  const totalSpent = agents?.reduce((s, a) => s + BigInt(a.totalSpent ?? 0), 0n) ?? 0n;
  const cardsToday = agents?.reduce((s, a) => s + (a._count?.cards ?? 0), 0) ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Fleet Overview</h1>
          <p className="text-kite-muted text-sm mt-0.5">Manage your AI agent fleet and wallets</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-ghost flex items-center gap-1.5">
            <RefreshCw size={13} />
            Refresh
          </button>
          <Link href="/dashboard/agents/new" className="btn-primary flex items-center gap-1.5">
            <Plus size={13} />
            New Agent
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Agents', value: totalAgents.toString(), color: 'text-slate-100' },
          { label: 'Active Agents', value: activeAgents.toString(), color: 'text-green-400' },
          { label: 'Total Settled', value: null, usdc: totalSpent, color: 'text-kite-blue' },
          { label: 'Cards Issued', value: cardsToday.toString(), color: 'text-amber-400' },
        ].map(({ label, value, usdc, color }) => (
          <div key={label} className="card">
            <p className="text-kite-muted text-xs uppercase tracking-widest mb-2">{label}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : usdc !== undefined ? (
              <USDCAmount amount={usdc} className={`text-2xl font-bold ${color}`} />
            ) : (
              <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Agent Fleet Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-kite-border flex items-center justify-between">
          <h2 className="text-sm font-medium">Agent Fleet</h2>
          <span className="text-kite-muted text-xs">{totalAgents} agents</span>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} cols={7} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kite-border text-kite-muted text-xs uppercase tracking-wider">
                  {['Agent', 'Group', 'Status', 'Vault Balance', 'Daily Spent', 'Total Spent', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents?.map((agent) => (
                  <tr key={agent.id} className="border-b border-kite-border table-row-hover">
                    <td className="px-4 py-3">
                      <div>
                        <Link
                          href={`/dashboard/agents/${agent.id}`}
                          className="text-slate-100 hover:text-kite-blue transition-colors font-medium"
                        >
                          {agent.name}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-kite-muted text-xs font-mono">
                            {agent.agentId.slice(0, 8)}…
                          </span>
                          <CopyButton value={agent.agentId} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-kite-muted">{agent.groupName}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={agent.status as 'ACTIVE' | 'SUSPENDED' | 'PENDING'} />
                    </td>
                    <td className="px-4 py-3">
                      {agent.vaultAddress ? (
                        <USDCAmount amount={0n} className="text-xs" />
                      ) : (
                        <span className="text-kite-muted text-xs">Deploying…</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <USDCAmount amount={0n} className="text-xs" />
                    </td>
                    <td className="px-4 py-3">
                      <USDCAmount amount={agent.totalSpent ?? 0n} className="text-xs" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {agent.status === 'ACTIVE' ? (
                          <button
                            onClick={() => suspendMutation.mutate({ agentId: agent.id })}
                            disabled={suspendMutation.isPending}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                            Suspend
                          </button>
                        ) : agent.status === 'SUSPENDED' ? (
                          <button
                            onClick={() => resumeMutation.mutate({ agentId: agent.id })}
                            disabled={resumeMutation.isPending}
                            className="text-xs text-green-400 hover:text-green-300 transition-colors"
                          >
                            Resume
                          </button>
                        ) : null}
                        <Link
                          href={`/dashboard/agents/${agent.id}`}
                          className="text-xs text-kite-blue hover:text-blue-400 transition-colors"
                        >
                          Detail →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {agents?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-kite-muted">
                      No agents yet.{' '}
                      <Link href="/dashboard/agents/new" className="text-kite-blue hover:underline">
                        Create your first agent →
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
