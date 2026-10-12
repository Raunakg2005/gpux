import { describe, it } from "vitest";
import { createTestIndexer } from "envio";

// Runs the real handlers over GPUx's actual Monad testnet history via HyperSync.
describe("GPUx indexer on Monad testnet", () => {
  it("indexes deployment, seeding, trades, CRE settlement and index updates", async (t) => {
    const indexer = createTestIndexer();
    const result = await indexer.process({
      chains: { 10143: { startBlock: 70_458_381, endBlock: Number(process.env.END_BLOCK ?? 70_500_000) } },
    });

    const sets = (entity: string) =>
      result.changes.flatMap((c: any) => c[entity]?.sets ?? []) as any[];

    const series = sets("Series");
    t.expect(new Set(series.map((s) => s.id)).size).toBe(4);
    t.expect(series.some((s) => s.gpuType === "B200" && s.region === "US-WEST")).toBe(true);

    const redemptions = sets("Redemption");
    const r0 = redemptions.filter((r) => r.id === "0").at(-1);
    t.expect(r0?.status).toBe("Delivered"); // settled by the CRE workflow
    t.expect(r0?.settleTx).toMatch(/^0x/);

    const providers = sets("Provider");
    t.expect(providers.at(-1)?.name).toBe("NeoCloud Labs");
    t.expect(providers.at(-1)?.deliveriesOk).toBe(1);

    t.expect(sets("Fill").length).toBeGreaterThan(0); // user's market buy on Kuru
    t.expect(sets("IndexPoint").length).toBeGreaterThanOrEqual(8); // seed + CRE publishes
  });
});
