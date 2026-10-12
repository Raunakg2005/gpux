import { type CommandIO, CommandError, InputFieldType, type InputSchema, PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { encodeFunctionData, parseUnits } from "viem";
import { AUSD_DECIMALS, CONTRACTS } from "../../lib/config.js";
import { mockAusdAbi } from "../../lib/chain.js";
import { activeWallet, runSteps, type Step, stepsHint } from "../../lib/wallet.js";

const inputs = {
  amount: { type: InputFieldType.Text, flag: "amount", message: "Testnet AUSD to mint (max 1000)", required: false, prompt: false },
} satisfies InputSchema;

export default class GpuxFaucet extends PluginCommand<{ wallet: string; amount: number; steps: Step[] }> {
  static override description = "Mint testnet AUSD (GPUx MockAUSD on Monad Testnet) to the agent wallet so it can trade compute.";
  static override examples = ["<%= config.bin %> gpux faucet --amount 500"];
  static override requiresAuth = true;
  static override requiresInit = true;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "gpux:faucet";

  async execute(io: CommandIO) {
    const r = await io.resolveInputs(inputs);
    const amount = r.amount ? Number(r.amount) : 1000;
    if (!(amount > 0 && amount <= 1000)) throw new CommandError("GPUX_BAD_AMOUNT", "--amount must be between 0 and 1000.", "Example: --amount 500");
    const owner = activeWallet(this.ctx);
    const steps: Step[] = [
      {
        step: "faucet",
        to: CONTRACTS.ausd,
        data: encodeFunctionData({ abi: mockAusdAbi, functionName: "faucet", args: [owner, parseUnits(String(amount), AUSD_DECIMALS)] }),
        summary: `Mint ${amount} testnet AUSD to ${owner}`,
      },
    ];
    const executor = await this.ctx.walletExecutor(io, this.pluginCommandId);
    await runSteps(executor as never, owner, steps, (msg) => io.progress(msg));
    return { wallet: owner, amount, steps };
  }

  override successHint(d: { amount: number; steps: Step[] }): string {
    return stepsHint(d.steps, `Minted ${d.amount} testnet AUSD. Next: mm gpux markets`);
  }
}
