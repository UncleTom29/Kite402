/**
 * Goldsky subgraph query helpers — real-time on-chain analytics for the dashboard.
 */

const SUBGRAPH_URL =
  process.env.GOLDSKY_SUBGRAPH_URL ??
  'https://api.goldsky.com/api/public/project_placeholder/subgraphs/kite402/v1/gn';

async function query<T>(gql: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.GOLDSKY_API_KEY
        ? { Authorization: `Bearer ${process.env.GOLDSKY_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({ query: gql, variables }),
  });

  if (!res.ok) throw new Error(`Goldsky query failed (${res.status}): ${res.statusText}`);

  const json = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`GraphQL error: ${json.errors[0].message}`);
  return json.data;
}

export interface OperatorStats {
  id: string;
  totalAgents: number;
  totalCardsIssued: number;
  totalUsdcSettled: string;
  lastActivity: string;
}

export interface AgentVaultEvent {
  id: string;
  agentId: string;
  eventType: string;
  amount: string | null;
  timestamp: string;
  txHash: string;
}

export interface AttestationEvent {
  id: string;
  agentId: string;
  usdcAmount: string;
  cardHash: string;
  timestamp: string;
  revoked: boolean;
  revokedAt: string | null;
}

export async function getOperatorStats(operatorAddress: string): Promise<OperatorStats | null> {
  const data = await query<{ operatorStats: OperatorStats | null }>(
    `query GetOperatorStats($id: ID!) {
      operatorStats(id: $id) {
        id
        totalAgents
        totalCardsIssued
        totalUsdcSettled
        lastActivity
      }
    }`,
    { id: operatorAddress.toLowerCase() },
  );
  return data.operatorStats;
}

export async function getAgentHistory(
  agentId: string,
  limit = 50,
): Promise<AgentVaultEvent[]> {
  const data = await query<{ agentVaultEvents: AgentVaultEvent[] }>(
    `query GetAgentHistory($agentId: Bytes!, $limit: Int!) {
      agentVaultEvents(
        where: { agentId: $agentId }
        orderBy: timestamp
        orderDirection: desc
        first: $limit
      ) {
        id
        agentId
        eventType
        amount
        timestamp
        txHash
      }
    }`,
    { agentId, limit },
  );
  return data.agentVaultEvents;
}

export async function getAttestations(agentId: string): Promise<AttestationEvent[]> {
  const data = await query<{ attestationEvents: AttestationEvent[] }>(
    `query GetAttestations($agentId: Bytes!) {
      attestationEvents(
        where: { agentId: $agentId }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        agentId
        usdcAmount
        cardHash
        timestamp
        revoked
        revokedAt
      }
    }`,
    { agentId },
  );
  return data.attestationEvents;
}

export async function getDailySpend(
  agentId: string,
  days = 30,
): Promise<{ date: string; amount: string }[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const data = await query<{ agentVaultEvents: AgentVaultEvent[] }>(
    `query GetDailySpend($agentId: Bytes!, $since: BigInt!) {
      agentVaultEvents(
        where: { agentId: $agentId, eventType: "WITHDRAW", timestamp_gte: $since }
        orderBy: timestamp
        orderDirection: asc
        first: 1000
      ) {
        amount
        timestamp
      }
    }`,
    { agentId, since: since.toString() },
  );

  // Group by day
  const byDay: Record<string, bigint> = {};
  for (const event of data.agentVaultEvents) {
    const date = new Date(Number(event.timestamp) * 1000).toISOString().slice(0, 10);
    byDay[date] = (byDay[date] ?? 0n) + BigInt(event.amount ?? '0');
  }

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount: amount.toString() }));
}
