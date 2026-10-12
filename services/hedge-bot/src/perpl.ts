// TODO(perpl): implement against Perpl API docs (auth with PERPL_API_KEY).
export type Exposure = { user: `0x${string}`; notionalAusd: number; hedgeRatio: number };

export const perpl = {
  async loadExposures(): Promise<Exposure[]> {
    return [];
  },
  async rebalanceHedge(_e: Exposure, _signal: number): Promise<void> {},
};
