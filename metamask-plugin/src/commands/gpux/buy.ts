import { type CommandIO, CommandError, InputFieldType, type InputSchema, PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { encodeFunctionData, parseUnits } from "viem";
import { CONTRACTS, DEFAULT_MAX_PREMIUM_BPS, DEFAULT_MAX_SPEND_AUSD, DEFAULT_SLIPPAGE_BPS } from "../../lib/config.js";
import { erc20Abi, findMarket, indexPrice, l2Book, marketParams, orderBookAbi } from "../../lib/chain.js";
import { checkBuy, fillBuy, minOut } from "../../lib/guard.js";
import { activeWallet, runSteps, type Step, stepsHint } from "../../lib/wallet.js";

const inputs = {
  market: { type: InputFieldType.Text, flag: "market", message: "Compute market, e.g. H100-US-EAST", required: true, prompt: false },
  spend: { type: InputFieldType.Text, flag: "spend", message: "AUSD to spend", required: true, prompt: false },
  maxSpend: { type: InputFieldType.Text, flag: "max-spend", message: `Refuse if spend exceeds this many AUSD (default ${DEFAULT_MAX_SPEND_AUSD})`, required: false, prompt: false },
  maxPremiumBps: { type: InputFieldType.Text, flag: "max-premium-bps", message: `Refuse if the average fill is more than this above the CRE index (default ${DEFAULT_MAX_PREMIUM_BPS})`, required: false, prompt: false },
  slippageBps: { type: InputFieldType.Text, flag: "slippage-bps", message: `Max slippage vs the quote (default ${DEFAULT_SLIPPAGE_BPS})`, required: false, prompt: false },
  dryRun: { type: InputFieldType.Boolean, flag: "dry-run", message: "Quote and check guardrails without sending", required: false, prompt: false, default: false },
} satisfies InputSchema;

export type BuyResult = { market: string; wallet: string; spend: number; expectedHours: number; avgPrice: number; indexPrice: number; dryRun: boolean; steps: Step[] };

export default class GpuxBuy extends PluginCommand<BuyResult> {
  static override description =
    "Buy bonded GPU-hours on Kuru with AUSD. Guardrails: spend cap, refuses fills far above the Chainlink-CRE index, simulates before signing. Signed by your MetaMask wallet (policy, threat scan, 2FA).";
  static override examples = [
    "<%= config.bin %> gpux buy --market H100-US-EAST --spend 25",
    "<%= config.bin %> gpux buy --market B200-US-WEST --spend 50 --dry-run --json",
  ];
  static override requiresAuth = true;
  static override requiresInit = true;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "gpux:buy";

  async execute(io: CommandIO): Promise<BuyResult> {
    const r = await io.resolveInputs(inputs);
    const m = findMarket(r.market);
    const spend = Number(r.spend);
    if (!(spend > 0)) throw new CommandError("GPUX_BAD_AMOUNT", "--spend must be a positive AUSD amount.", "Example: --spend 25");
    const maxSpend = r.maxSpend ? Number(r.maxSpend) : DEFAULT_MAX_SPEND_AUSD;
    const maxPremiumBps = r.maxPremiumBps ? Number(r.maxPremiumBps) : DEFAULT_MAX_PREMIUM_BPS;
    const slippageBps = r.slippageBps ? Number(r.slippageBps) : DEFAULT_SLIPPAGE_BPS;
    const owner = activeWallet(this.ctx);

    io.progress(`Quoting ${spend} AUSD of ${m.id}`);
    const p = await marketParams(m.orderBook);
    const [book, idx] = await Promise.all([l2Book(m.orderBook, p), indexPrice(m)]);
    io.progress(undefined);
    const fill = fillBuy(book, spend);
    const guard = checkBuy(fill, { spend, maxSpend, indexPrice: idx, maxPremiumBps });
    if (!guard.ok) throw new CommandError(guard.code, guard.message, guard.hint);

    const pd = String(p.pricePrecision).length - 1;
    const steps: Step[] = [
      {
        step: "approve",
        to: CONTRACTS.ausd,
        data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [m.orderBook, parseUnits(spend.toFixed(p.quoteDecimals), p.quoteDecimals)] }),
        summary: `Approve ${spend} AUSD for the ${m.id} Kuru market`,
      },
      {
        step: "marketBuy",
        to: m.orderBook,
        data: encodeFunctionData({
          abi: orderBookAbi,
          functionName: "placeAndExecuteMarketBuy",
          args: [parseUnits(spend.toFixed(pd), pd), parseUnits(minOut(fill.base, slippageBps).toFixed(p.baseDecimals), p.baseDecimals), false, false],
        }),
        summary: `Buy ~${fill.base.toFixed(3)} ${m.id} GPU-hours for ${spend} AUSD (avg ${fill.avgPrice.toFixed(4)}, index ${idx.toFixed(4)})`,
      },
    ];
    const result: BuyResult = { market: m.id, wallet: owner, spend, expectedHours: fill.base, avgPrice: fill.avgPrice, indexPrice: idx, dryRun: Boolean(r.dryRun), steps };
    if (r.dryRun) return result;

    const executor = await this.ctx.walletExecutor(io, this.pluginCommandId);
    await runSteps(executor as never, owner, steps, (msg) => io.progress(msg));
    return result;
  }

  override successHint(d: BuyResult): string {
    if (d.dryRun) return `Dry run passed guardrails: ${d.spend} AUSD -> ~${d.expectedHours.toFixed(3)} ${d.market} GPU-hours. Nothing sent.`;
    return stepsHint(d.steps, `Bought ~${d.expectedHours.toFixed(3)} ${d.market} GPU-hours. Check: mm gpux portfolio`);
  }
}
