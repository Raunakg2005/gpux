import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type CommandIO, CommandError, InputFieldType, type InputSchema, PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { bytesToHex, encodeFunctionData, parseUnits, sha256 } from "viem";
import { CONTRACTS, HOUR_DECIMALS } from "../../lib/config.js";
import { balanceOf, escrowAbi, findMarket } from "../../lib/chain.js";
import { activeWallet, runSteps, type Step, stepsHint } from "../../lib/wallet.js";

const inputs = {
  market: { type: InputFieldType.Text, flag: "market", message: "Compute market, e.g. H100-US-EAST", required: true, prompt: false },
  hours: { type: InputFieldType.Text, flag: "hours", message: "GPU-hours to redeem for delivery", required: true, prompt: false },
} satisfies InputSchema;

export type RedeemResult = { market: string; wallet: string; hours: number; accessTokenFile: string; commitment: string; steps: Step[] };

export default class GpuxRedeem extends PluginCommand<RedeemResult> {
  static override description =
    "Redeem GPU-hours for compute delivery. Generates an access token (kept locally, only its sha256 goes onchain); the Chainlink CRE workflow then settles delivery or slashes the provider's bond to you.";
  static override examples = ["<%= config.bin %> gpux redeem --market H100-US-EAST --hours 1"];
  static override requiresAuth = true;
  static override requiresInit = true;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "gpux:redeem";

  async execute(io: CommandIO): Promise<RedeemResult> {
    const r = await io.resolveInputs(inputs);
    const m = findMarket(r.market);
    const hours = Number(r.hours);
    if (!(hours > 0)) throw new CommandError("GPUX_BAD_AMOUNT", "--hours must be positive.", "Example: --hours 1");
    const owner = activeWallet(this.ctx);
    const amount = parseUnits(hours.toString(), HOUR_DECIMALS);
    if ((await balanceOf(m.token, owner)) < amount) {
      throw new CommandError("GPUX_INSUFFICIENT_HOURS", `This wallet holds fewer than ${hours} ${m.id} GPU-hours.`, `Buy first: mm gpux buy --market ${m.id} --spend <AUSD>`);
    }

    const token = randomBytes(32);
    const commitment = sha256(token);
    const dir = join(homedir(), ".metamask", "gpux-access");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${m.id}-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify({ market: m.id, hours, accessToken: bytesToHex(token), commitment }, null, 2), { mode: 0o600 });

    const steps: Step[] = [
      {
        step: "redeem",
        to: CONTRACTS.escrow,
        data: encodeFunctionData({ abi: escrowAbi, functionName: "redeem", args: [m.seriesId, amount, commitment] }),
        summary: `Redeem ${hours} ${m.id} GPU-hours for delivery`,
      },
    ];
    const executor = await this.ctx.walletExecutor(io, this.pluginCommandId);
    await runSteps(executor as never, owner, steps, (msg) => io.progress(msg));
    return { market: m.id, wallet: owner, hours, accessTokenFile: file, commitment, steps };
  }

  override successHint(d: RedeemResult): string {
    return stepsHint(d.steps, `Redeemed ${d.hours} ${d.market} GPU-hours. Access token saved to ${d.accessTokenFile}. Delivery is verified by Chainlink CRE; track it with mm gpux portfolio.`);
  }
}
