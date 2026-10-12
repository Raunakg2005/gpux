import { type CommandIO, CommandError, InputFieldType, type InputSchema, PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { findMarket, indexPrice, l2Book, marketParams } from "../../lib/chain.js";
import { fillBuy, fillSell } from "../../lib/guard.js";

const inputs = {
  market: { type: InputFieldType.Text, flag: "market", message: "Compute market, e.g. H100-US-EAST", required: true, prompt: false },
  side: { type: InputFieldType.Text, flag: "side", message: "buy (amount = AUSD to spend) or sell (amount = GPU-hours)", required: true, prompt: false },
  amount: { type: InputFieldType.Text, flag: "amount", message: "AUSD to spend (buy) or GPU-hours to sell", required: true, prompt: false },
} satisfies InputSchema;

export type QuoteResult = { market: string; side: string; gpuHours: number; ausd: number; avgPrice: number; indexPrice: number; premiumBps: number; filledFully: boolean };

export default class GpuxQuote extends PluginCommand<QuoteResult> {
  static override description = "Quote a GPU-hour buy or sell against the live Kuru book and compare it with the Chainlink-CRE compute index. No wallet needed.";
  static override examples = ["<%= config.bin %> gpux quote --market H100-US-EAST --side buy --amount 25"];
  static override requiresAuth = false;
  static override requiresInit = false;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "gpux:quote";

  async execute(io: CommandIO): Promise<QuoteResult> {
    const r = await io.resolveInputs(inputs);
    const m = findMarket(r.market);
    const side = String(r.side).toLowerCase();
    const amount = Number(r.amount);
    if (!["buy", "sell"].includes(side)) throw new CommandError("GPUX_BAD_SIDE", `--side must be buy or sell, got '${r.side}'.`, "Use --side buy or --side sell.");
    if (!(amount > 0)) throw new CommandError("GPUX_BAD_AMOUNT", `--amount must be a positive number.`, "Example: --amount 25");

    const p = await marketParams(m.orderBook);
    const [book, idx] = await Promise.all([l2Book(m.orderBook, p), indexPrice(m)]);
    const f = side === "buy" ? fillBuy(book, amount) : fillSell(book, amount);
    return {
      market: m.id,
      side,
      gpuHours: f.base,
      ausd: f.quote,
      avgPrice: f.avgPrice,
      indexPrice: idx,
      premiumBps: idx > 0 ? Math.round(((f.avgPrice - idx) / idx) * 10_000) : 0,
      filledFully: f.filledFully,
    };
  }

  override successHint(d: QuoteResult): string {
    return d.side === "buy"
      ? `${d.ausd.toFixed(2)} AUSD buys ~${d.gpuHours.toFixed(3)} ${d.market} GPU-hours at ${d.avgPrice.toFixed(4)} (${d.premiumBps} bps vs index). Execute: mm gpux buy --market ${d.market} --spend ${d.ausd.toFixed(2)}`
      : `${d.gpuHours.toFixed(3)} GPU-hours sell for ~${d.ausd.toFixed(2)} AUSD. Execute: mm gpux sell --market ${d.market} --hours ${d.gpuHours}`;
  }
}
