import { indexer } from "envio";

// ComputeIndex prices published by the Chainlink CRE index-publisher.
indexer.onEvent({ contract: "ComputeIndex", event: "IndexUpdated" }, async ({ event, context }) => {
  context.IndexPoint.set({
    id: `${event.params.key}-${event.params.timestamp}-${event.logIndex}`,
    key: event.params.key,
    price: event.params.price,
    timestamp: Number(event.params.timestamp),
  });
});

// Fills on the Kuru order books that list GPUx compute contracts.
indexer.onEvent({ contract: "KuruOrderBook", event: "Trade" }, async ({ event, context }) => {
  const market = event.srcAddress.toLowerCase();
  context.Fill.set({
    id: `${event.block.number}-${event.logIndex}`,
    market,
    isBuy: event.params.isBuy,
    price: event.params.price,
    size: event.params.filledSize,
    maker: event.params.makerAddress.toLowerCase(),
    taker: event.params.takerAddress.toLowerCase(),
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
  const stats = await context.MarketStats.get(market);
  context.MarketStats.set({
    id: market,
    trades: (stats?.trades ?? 0) + 1,
    volume: (stats?.volume ?? 0n) + event.params.filledSize,
    lastPrice: event.params.price,
    lastTradeAt: event.block.timestamp,
  });
});
