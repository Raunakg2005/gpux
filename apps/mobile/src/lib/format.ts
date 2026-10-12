import { formatUnits } from "viem";

export const fmt = (v: bigint, decimals: number, dp = 2) =>
  Number(formatUnits(v, decimals)).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const usd = (n: number, dp = 2) => `$${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`;
