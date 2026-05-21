'use client';

import { useState } from 'react';
import { trpc } from '../../providers';
import { Skeleton } from '../../../components/ui/Skeleton';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AuditPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.audit.list.useQuery(
    {
      page,
      perPage: 25,
    },
    {
      keepPreviousData: true,
      refetchInterval: 10000,
    },
  );

  const canPrev = page > 1;
  const canNext = page < (data?.totalPages ?? 1);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileText size={18} className="text-kite-blue" />
            Audit Log
          </h1>
          <p className="text-kite-muted text-sm mt-0.5">
            Immutable operator actions and agent-finance events
          </p>
        </div>
        <span className="text-xs text-kite-muted">
          {data?.total ?? 0} total events
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : data?.items.length ? (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kite-border text-kite-muted text-xs uppercase tracking-wider">
                  {['Time', 'Agent', 'Action', 'IP', 'Metadata'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b border-kite-border table-row-hover align-top">
                    <td className="px-4 py-3 text-kite-muted text-xs whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {item.agent?.name ? (
                        <div>
                          <p className="text-slate-100 font-medium">{item.agent.name}</p>
                          <p className="text-kite-muted font-mono">{item.agent.agentId.slice(0, 12)}…</p>
                        </div>
                      ) : (
                        <span className="text-kite-muted">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-kite-border px-1.5 py-0.5 rounded">
                        {item.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-kite-muted text-xs">{item.ip ?? '—'}</td>
                    <td className="px-4 py-3 text-kite-muted text-xs font-mono max-w-md truncate">
                      {item.metadata ? JSON.stringify(item.metadata) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-kite-border flex items-center justify-between">
            <p className="text-xs text-kite-muted">
              Page {data.page} of {data.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => canPrev && setPage((p) => p - 1)}
                disabled={!canPrev}
                className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-50"
              >
                <ChevronLeft size={12} />
                Previous
              </button>
              <button
                onClick={() => canNext && setPage((p) => p + 1)}
                disabled={!canNext}
                className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-50"
              >
                Next
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center py-16">
          <FileText size={32} className="mx-auto text-kite-muted mb-3" />
          <p className="text-slate-200 font-medium">No audit events yet</p>
          <p className="text-kite-muted text-sm mt-1">Events will appear here as operators and agents perform actions</p>
        </div>
      )}
    </div>
  );
}