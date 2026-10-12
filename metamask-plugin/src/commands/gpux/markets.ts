import { type CommandIO, PluginCommand } from "@metamask/agent-wallet/plugin";
import { MARKETS } from "../../lib/config.js";
import { indexPrice, l2Book, marketParams } from "../../lib/chain.js";

export type MarketRow = { id: string; gpu: string; region: string; bid?: number; ask?: number; indexPrice: number; askDepthHours: number };

export default class GpuxMarkets extends PluginCommand<{ markets: MarketRow[] }> {
  static override description =
    "List GPU compute markets (bonded GPU-hour contracts on Kuru, Monad Testnet) with best bid/ask and the Chainlink-CRE index price. Public data, no wallet needed.";
  static override examples = ["<%= config.bin %> gpux markets", "<%= config.bin %> gpux markets --json"];
  static override requiresAuth = false;
  static override requiresInit = false;

  protected readonly pluginCommandId = "gpux:markets";

  async execute(io: CommandIO): Promise<{ markets: MarketRow[] }> {
    io.progress("Reading Kuru order books and the compute index");
    const markets = await Promise.all(
      MARKETS.map(async (m) => {
        const p = await marketParams(m.orderBook);
        const [book, idx] = await Promise.all([l2Book(m.orderBook, p), indexPrice(m)]);
        return {
          id: m.id,
          gpu: m.gpuType,
          region: m.region,
          bid: book.bids[0]?.price,
          ask: book.asks[0]?.price,
          indexPrice: idx,
          askDepthHours: book.asks.reduce((a, l) => a + l.size, 0),
        };
      }),
    );
    io.progress(undefined);
    return { markets };
  }

  override successHint(): string {
    return "Quote a trade with `mm gpux quote --market H100-US-EAST --side buy --amount 25`, then `mm gpux buy`.";
  }
}
