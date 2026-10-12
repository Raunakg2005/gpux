import { type CommandIO, PluginCommand } from "@metamask/agent-wallet/plugin";
import { formatUnits } from "viem";
import { AUSD_DECIMALS, CONTRACTS, HOUR_DECIMALS, INDEXER_URL, MARKETS } from "../../lib/config.js";
import { balanceOf, indexPrice } from "../../lib/chain.js";
import { activeWallet } from "../../lib/wallet.js";

type Redemption = { id: string; seriesId: string; amount: string; status: string; settleTx: string | null };
export type PortfolioResult = {
  wallet: string;
  ausd: number;
  positions: { market: string; hours: number; valueAusd: number }[];
  totalValueAusd: number;
  deliveries: { id: string; market: string; hours: number; status: string; settleTx: string | null }[];
};

export default class GpuxPortfolio extends PluginCommand<PortfolioResult> {
  static override description = "Show the agent wallet's AUSD, GPU-hour positions (marked at the Chainlink-CRE index) and deliveries (from the Envio indexer).";
  static override examples = ["<%= config.bin %> gpux portfolio --json"];
  static override requiresAuth = true;
  static override requiresInit = true;

  protected readonly pluginCommandId = "gpux:portfolio";

  async execute(io: CommandIO): Promise<PortfolioResult> {
    const owner = activeWallet(this.ctx);
    io.progress("Reading balances");
    const [ausd, rows] = await Promise.all([
      balanceOf(CONTRACTS.ausd, owner),
      Promise.all(MARKETS.map(async (m) => ({ m, bal: await balanceOf(m.token, owner), idx: await indexPrice(m) }))),
    ]);
    const positions = rows
      .filter((x) => x.bal > 0n)
      .map(({ m, bal, idx }) => {
        const hours = Number(formatUnits(bal, HOUR_DECIMALS));
        return { market: m.id, hours, valueAusd: hours * idx };
      });

    let deliveries: PortfolioResult["deliveries"] = [];
    try {
      const res = await fetch(INDEXER_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "query($u:String!){Redemption(where:{buyer:{_eq:$u}},order_by:{requestedAt:desc}){id seriesId amount status settleTx}}",
          variables: { u: owner.toLowerCase() },
        }),
      });
      const body = (await res.json()) as { data?: { Redemption: Redemption[] } };
      deliveries = (body.data?.Redemption ?? []).map((d) => ({
        id: d.id,
        market: MARKETS.find((m) => String(m.seriesId) === d.seriesId)?.id ?? `series ${d.seriesId}`,
        hours: Number(formatUnits(BigInt(d.amount), HOUR_DECIMALS)),
        status: d.status,
        settleTx: d.settleTx,
      }));
    } catch {
      // indexer optional
    }
    io.progress(undefined);
    return {
      wallet: owner,
      ausd: Number(formatUnits(ausd, AUSD_DECIMALS)),
      positions,
      totalValueAusd: positions.reduce((a, p) => a + p.valueAusd, 0),
      deliveries,
    };
  }

  override successHint(d: PortfolioResult): string {
    return `${d.positions.length} GPU-hour position(s) worth ~${d.totalValueAusd.toFixed(2)} AUSD; ${d.ausd.toFixed(2)} AUSD free; ${d.deliveries.length} delivery request(s).`;
  }
}
