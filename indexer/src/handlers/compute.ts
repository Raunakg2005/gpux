import { indexer } from "envio";

const ZERO = "0x0000000000000000000000000000000000000000";

// Every new compute series deploys its own ComputeToken; index its transfers too.
indexer.contractRegister(
  { contract: "ComputeContractFactory", event: "SeriesCreated" },
  async ({ event, context }) => {
    context.chain.ComputeToken.add(event.params.token);
  },
);

indexer.onEvent({ contract: "ComputeContractFactory", event: "SeriesCreated" }, async ({ event, context }) => {
  context.Series.set({
    id: event.params.seriesId.toString(),
    provider: event.params.provider.toLowerCase(),
    token: event.params.token.toLowerCase(),
    gpuType: event.params.gpuType,
    region: event.params.region,
    deliveryStart: event.params.deliveryStart,
    minted: 0n,
    bondLocked: 0n,
    redeemed: 0n,
  });
});

indexer.onEvent({ contract: "ComputeContractFactory", event: "CapacityMinted" }, async ({ event, context }) => {
  const series = await context.Series.getOrThrow(event.params.seriesId.toString());
  context.Series.set({
    ...series,
    minted: series.minted + event.params.amount,
    bondLocked: series.bondLocked + event.params.bondLocked,
  });
});

indexer.onEvent({ contract: "ComputeToken", event: "Transfer" }, async ({ event, context }) => {
  const token = event.srcAddress.toLowerCase();
  const { from, to, value } = event.params;
  for (const [user, delta] of [
    [from, -value],
    [to, value],
  ] as const) {
    if (user === ZERO) continue;
    const id = `${token}-${user.toLowerCase()}`;
    const existing = await context.Holding.get(id);
    context.Holding.set({
      id,
      user: user.toLowerCase(),
      token,
      balance: (existing?.balance ?? 0n) + delta,
    });
  }
});
