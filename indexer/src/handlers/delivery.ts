import { indexer } from "envio";

indexer.onEvent({ contract: "DeliveryEscrow", event: "RedemptionRequested" }, async ({ event, context }) => {
  const seriesId = event.params.seriesId.toString();
  context.Redemption.set({
    id: event.params.id.toString(),
    seriesId,
    buyer: event.params.buyer.toLowerCase(),
    amount: event.params.amount,
    status: "Pending",
    bondAmount: undefined,
    requestedAt: event.block.timestamp,
    settledAt: undefined,
    requestTx: event.transaction.hash,
    settleTx: undefined,
  });
  const series = await context.Series.get(seriesId);
  if (series) context.Series.set({ ...series, redeemed: series.redeemed + event.params.amount });
});

// Emitted when the Chainlink CRE workflow's report settles a redemption.
indexer.onEvent({ contract: "DeliveryEscrow", event: "DeliverySettled" }, async ({ event, context }) => {
  const r = await context.Redemption.getOrThrow(event.params.id.toString());
  context.Redemption.set({
    ...r,
    status: event.params.delivered ? "Delivered" : "Failed",
    bondAmount: event.params.bondAmount,
    settledAt: event.block.timestamp,
    settleTx: event.transaction.hash,
  });
});

const provider = async (context: any, address: string) =>
  (await context.Provider.get(address)) ?? {
    id: address,
    name: "",
    deliveriesOk: 0,
    deliveriesFailed: 0,
    bondDeposited: 0n,
    bondSlashed: 0n,
  };

indexer.onEvent({ contract: "ProviderRegistry", event: "ProviderRegistered" }, async ({ event, context }) => {
  const p = await provider(context, event.params.provider.toLowerCase());
  context.Provider.set({ ...p, name: event.params.name });
});

indexer.onEvent({ contract: "ProviderRegistry", event: "DeliveryRecorded" }, async ({ event, context }) => {
  const p = await provider(context, event.params.provider.toLowerCase());
  context.Provider.set(
    event.params.ok ? { ...p, deliveriesOk: p.deliveriesOk + 1 } : { ...p, deliveriesFailed: p.deliveriesFailed + 1 },
  );
});

indexer.onEvent({ contract: "SLABondVault", event: "Deposited" }, async ({ event, context }) => {
  const p = await provider(context, event.params.provider.toLowerCase());
  context.Provider.set({ ...p, bondDeposited: p.bondDeposited + event.params.amount });
});

indexer.onEvent({ contract: "SLABondVault", event: "Slashed" }, async ({ event, context }) => {
  const p = await provider(context, event.params.provider.toLowerCase());
  context.Provider.set({ ...p, bondSlashed: p.bondSlashed + event.params.amount });
});
