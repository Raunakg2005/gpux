import { type CommandIO, CommandError, InputFieldType, type InputSchema, PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { encodeFunctionData, parseUnits } from "viem";
import { DEFAULT_MAX_PREMIUM_BPS, DEFAULT_SLIPPAGE_BPS } from "../../lib/config.js";
import { erc20Abi, findMarket, indexPrice, l2Book, marketParams, orderBookAbi } from "../../lib/chain.js";
import { checkSell, fillSell, minOut } from "../../lib/guard.js";
import { activeWallet, runSteps, type Step, stepsHint } from "../../lib/wallet.js";

const inputs = {
  market: { type: InputFieldType.Text, flag: "market", message: "Compute market, e.g. H100-US-EAST", required: true, prompt: false },
  hours: { type: InputFieldType.Text, flag: "hours", message: "GPU-hours to sell", required: true, prompt: false },
  maxPremiumBps: { type: InputFieldType.Text, flag: "max-premium-bps", message: `Refuse if the average fill is more than this below the CRE index (default ${DEFAULT_MAX_PREMIUM_BPS})`, required: false, prompt: false },
  slippageBps: { type: InputFieldType.Text, flag: "slippage-bps", message: `Max slippage vs the quote (default ${DEFAULT_SLIPPAGE_BPS})`, required: false, prompt: false },
  dryRun: { type: InputFieldType.Boolean, flag: "dry-run", message: "Quote and check guardrails without sending", required: false, prompt: false, default: false },
} satisfies InputSchema;

export type SellResult = { market: string; wallet: string; hours: number; expectedAusd: number; avgPrice: number; indexPrice: number; dryRun: boolean; steps: Step[] };

export default class GpuxSell extends PluginCommand<SellResult> {
  static override description = "Sell GPU-hours back into the Kuru book for AUSD, refusing fills far below the Chainlink-CRE index. Signed by your MetaMask wallet.";
  static override examples = ["<%= config.bin %> gpux sell --market H100-US-EAST --hours 2"];
  static override requiresAuth = true;
  static override requiresInit = true;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "gpux:sell";

  async execute(io: CommandIO): Promise<SellResult> {
    const r = await io.resolveInputs(inputs);
    const m = findMarket(r.market);
    const hours = Number(r.hours);
    if (!(hours > 0)) throw new CommandError("GPUX_BAD_AMOUNT", "--hours must be positive.", "Example: --hours 2");
    const maxPremiumBps = r.maxPremiumBps ? Number(r.maxPremiumBps) : DEFAULT_MAX_PREMIUM_BPS;
    const slippageBps = r.slippageBps ? Number(r.slippageBps) : DEFAULT_SLIPPAGE_BPS;
    const owner = activeWallet(this.ctx);

    const p = await marketParams(m.orderBook);
    const [book, idx] = await Promise.all([l2Book(m.orderBook, p), indexPrice(m)]);
    const fill = fillSell(book, hours);
    const guard = checkSell(fill, { hours, indexPrice: idx, maxPremiumBps });
    if (!guard.ok) throw new CommandError(guard.code, guard.message, guard.hint);

    const sd = String(p.sizePrecision).length - 1;
    const steps: Step[] = [
      {
        step: "approve",
        to: m.token,
        data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [m.orderBook, parseUnits(hours.toFixed(p.baseDecimals), p.baseDecimals)] }),
        summary: `Approve ${hours} ${m.id} GPU-hours for the Kuru market`,
      },
      {
        step: "marketSell",
        to: m.orderBook,
        data: encodeFunctionData({
          abi: orderBookAbi,
          functionName: "placeAndExecuteMarketSell",
          args: [parseUnits(hours.toFixed(sd), sd), parseUnits(minOut(fill.quote, slippageBps).toFixed(p.quoteDecimals), p.quoteDecimals), false, false],
        }),
        summary: `Sell ${hours} ${m.id} GPU-hours for ~${fill.quote.toFixed(2)} AUSD`,
      },
    ];
    const result: SellResult = { market: m.id, wallet: owner, hours, expectedAusd: fill.quote, avgPrice: fill.avgPrice, indexPrice: idx, dryRun: Boolean(r.dryRun), steps };
    if (r.dryRun) return result;

    const executor = await this.ctx.walletExecutor(io, this.pluginCommandId);
    await runSteps(executor as never, owner, steps, (msg) => io.progress(msg));
    return result;
  }

  override successHint(d: SellResult): string {
    if (d.dryRun) return `Dry run passed guardrails: ${d.hours} GPU-hours -> ~${d.expectedAusd.toFixed(2)} AUSD. Nothing sent.`;
    return stepsHint(d.steps, `Sold ${d.hours} ${d.market} GPU-hours for ~${d.expectedAusd.toFixed(2)} AUSD.`);
  }
}
