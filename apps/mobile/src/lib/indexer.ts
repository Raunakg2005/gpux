import { INDEXER_URL } from "./config";

/** Envio HyperIndex GraphQL (indexer/), hosted on Envio Cloud. */
async function query<T>(gql: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: gql, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(`Indexer: ${body.errors[0].message}`);
  return body.data as T;
}

export const indexerEnabled = () => INDEXER_URL.length > 0;

export type IndexedRedemption = {
  id: string;
  seriesId: string;
  amount: string;
  status: "Pending" | "Delivered" | "Failed";
  bondAmount: string | null;
  settleTx: string | null;
};

export async function redemptionsOf(user: string): Promise<IndexedRedemption[]> {
  const data = await query<{ Redemption: IndexedRedemption[] }>(
    `query($u: String!) { Redemption(where: { buyer: { _eq: $u } }, order_by: { requestedAt: desc }) {
      id seriesId amount status bondAmount settleTx } }`,
    { u: user.toLowerCase() },
  );
  return data.Redemption;
}

export type IndexedFill = { id: string; isBuy: boolean; price: string; size: string; timestamp: number; txHash: string };

export async function recentFills(market: string, limit = 10): Promise<IndexedFill[]> {
  const data = await query<{ Fill: IndexedFill[] }>(
    `query($m: String!, $n: Int!) { Fill(where: { market: { _eq: $m } }, order_by: { timestamp: desc }, limit: $n) {
      id isBuy price size timestamp txHash } }`,
    { m: market.toLowerCase(), n: limit },
  );
  return data.Fill;
}
