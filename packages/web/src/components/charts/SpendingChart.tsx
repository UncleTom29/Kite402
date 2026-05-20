'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '../ui/Skeleton';

interface SpendDataPoint {
  date: string;
  amount: string;
}

interface SpendingChartProps {
  agentId: string;
}

export function SpendingChart({ agentId }: SpendingChartProps) {
  const [data, setData] = useState<SpendDataPoint[] | null>(null);

  useEffect(() => {
    // Fetch from Goldsky subgraph via API
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${apiBase}/api/spend-chart/${agentId}`)
      .then((r) => r.json())
      .then((d: SpendDataPoint[]) => setData(d))
      .catch(() => {
        // Fallback demo data
        const now = Date.now();
        setData(
          Array.from({ length: 30 }, (_, i) => ({
            date: new Date(now - (29 - i) * 86400000).toISOString().slice(0, 10),
            amount: (Math.random() * 50 * 1e6).toFixed(0),
          })),
        );
      });
  }, [agentId]);

  if (!data) return <Skeleton className="h-48 w-full" />;

  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    usd: Number(d.amount) / 1e6,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0055FF" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#0055FF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#6B7280' }}
          tickLine={false}
          axisLine={false}
          interval={4}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#6B7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#12121A',
            border: '1px solid #1E1E2E',
            borderRadius: '6px',
            fontSize: '12px',
          }}
          formatter={(v: number) => [`$${v.toFixed(2)} USDC`, 'Spent']}
        />
        <Area
          type="monotone"
          dataKey="usd"
          stroke="#0055FF"
          strokeWidth={2}
          fill="url(#spendGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
