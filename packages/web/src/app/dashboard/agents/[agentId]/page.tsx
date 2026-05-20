'use client';

import { trpc } from '../../../providers';
import { StatusChip } from '../../../../components/ui/StatusChip';
import { USDCAmount } from '../../../../components/ui/USDCAmount';
import { KiteScanLink } from '../../../../components/ui/KiteScanLink';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { SpendingChart } from '../../../../components/charts/SpendingChart';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function AgentDetailPage({ params }: { params: { agentId: string } }) {
  const { data: agent, isLoading } = trpc.agents.get.useQuery({ agentId: params.agentId });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6">
        <p className="text-kite-muted">Agent not found.</p>
        <Link href="/dashboard" className="text-kite-blue hover:underline text-sm mt-2 block">
          ← Back to fleet
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-kite-muted hover:text-slate-200 text-xs mb-4 transition-colors w-fit"
        >
          <ArrowLeft size={12} />
          Fleet Overview
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">{agent.name}</h1>
              <StatusChip status={agent.status as 'ACTIVE' | 'SUSPENDED' | 'PENDING'} />
            </div>
            <p className="text-kite-muted text-sm mt-0.5">{agent.groupName}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-kite-muted text-xs">Agent ID:</span>
              <span className="font-mono text-xs">{agent.agentId.slice(0, 18)}…</span>
              <CopyButton value={agent.agentId} />
            </div>
            {agent.vaultAddress && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-kite-muted text-xs">Vault:</span>
                <KiteScanLink hash={agent.vaultAddress} type="address" />
                <CopyButton value={agent.vaultAddress} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Vault Balance */}
        <div className="card">
          <p className="text-kite-muted text-xs uppercase tracking-widest mb-3">Vault Balance</p>
          <USDCAmount amount={0n} className="text-2xl font-bold" />
          {agent.vaultAddress && (
            <div className="mt-3 pt-3 border-t border-kite-border">
              <p className="text-kite-muted text-xs mb-2">Top-up address QR</p>
              <QRCodeSVG
                value={agent.vaultAddress}
                size={80}
                bgColor="transparent"
                fgColor="#0055FF"
                level="M"
              />
            </div>
          )}
        </div>

        {/* Spend Policy */}
        <div className="card">
          <p className="text-kite-muted text-xs uppercase tracking-widest mb-3">Spend Policy</p>
          <div className="space-y-2">
            {[
              { label: 'Per Order', value: agent.policyPerOrder },
              { label: 'Daily Limit', value: agent.policyDaily },
              { label: 'Lifetime', value: agent.policyLifetime },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-kite-muted text-xs">{label}</span>
                <USDCAmount amount={value ?? 0n} className="text-xs" />
              </div>
            ))}
          </div>
          <Link
            href={`/dashboard/agents/${params.agentId}/policy`}
            className="text-kite-blue text-xs mt-3 block hover:underline"
          >
            Edit policy →
          </Link>
        </div>

        {/* Stats */}
        <div className="card">
          <p className="text-kite-muted text-xs uppercase tracking-widest mb-3">Statistics</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-kite-muted text-xs">Cards Issued</span>
              <span className="text-sm tabular-nums">{agent.cards?.length ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-kite-muted text-xs">Total Spent</span>
              <USDCAmount amount={agent.totalSpent ?? 0n} className="text-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* Spending Chart */}
      <div className="card">
        <p className="text-sm font-medium mb-4">Daily Spend (30 days)</p>
        <SpendingChart agentId={agent.agentId} />
      </div>

      {/* Cards Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-kite-border">
          <h3 className="text-sm font-medium">Issued Cards</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-kite-border text-kite-muted text-xs uppercase tracking-wider">
              {['Attestation ID', 'Amount', 'Issued At', 'Status', 'TX'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agent.cards?.map((card) => (
              <tr key={card.id} className="border-b border-kite-border table-row-hover">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs">{card.attestationId.slice(0, 14)}…</span>
                    <CopyButton value={card.attestationId} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <USDCAmount amount={card.usdcAmount} className="text-xs" />
                </td>
                <td className="px-4 py-3 text-kite-muted text-xs">
                  {new Date(card.issuedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {card.revokedAt ? (
                    <span className="text-red-400 text-xs">Revoked</span>
                  ) : (
                    <span className="text-green-400 text-xs">Active</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {card.txHash && <KiteScanLink hash={card.txHash} />}
                </td>
              </tr>
            ))}
            {!agent.cards?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-kite-muted text-sm">
                  No cards issued yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Audit Log */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-kite-border">
          <h3 className="text-sm font-medium">Audit Log</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-kite-border text-kite-muted text-xs uppercase tracking-wider">
              {['Action', 'Time', 'IP', 'Details'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agent.auditLogs?.map((log) => (
              <tr key={log.id} className="border-b border-kite-border table-row-hover">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-kite-border px-1.5 py-0.5 rounded">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-kite-muted text-xs">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-kite-muted text-xs">{log.ip ?? '—'}</td>
                <td className="px-4 py-3 text-kite-muted text-xs font-mono">
                  {JSON.stringify(log.metadata).slice(0, 60)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
