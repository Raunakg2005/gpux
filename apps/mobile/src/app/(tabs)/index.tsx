import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Body, c, Card, Label, Mono, Notice, Row } from "@/components/ui";
import { KURU_MARKETS } from "@/lib/config";
import { listSeries, indexPrice, getProvider, seriesLabel, AUSD_DECIMALS, type Series } from "@/lib/gpux";
import { getL2Book, mid } from "@/lib/kuru";
import { fmt, pct } from "@/lib/format";
import { usePoll } from "@/state/usePoll";

type Row = { s: Series; index: bigint; bid?: number; ask?: number; last?: number; reliability: number; provider: string };

async function load(): Promise<Row[]> {
  const series = await listSeries();
  return Promise.all(
    series.map(async (s) => {
      const market = KURU_MARKETS[s.token.toLowerCase()];
      const [idx, provider, book] = await Promise.all([
        indexPrice(s.gpuType, s.region),
        getProvider(s.provider),
        market ? getL2Book(market).catch(() => null) : null,
      ]);
      return {
        s,
        index: idx.price,
        bid: book?.bids[0]?.price,
        ask: book?.asks[0]?.price,
        last: book ? mid(book) : undefined,
        reliability: provider.reliabilityBps,
        provider: provider.name,
      };
    }),
  );
}

export default function Markets() {
  const { data, error } = usePoll(load, 2000);
  const now = Date.now() / 1000;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
      <Body dim style={{ marginBottom: 12 }}>
        Standardized GPU-hour contracts. Each one is backed by a provider bond that pays you if delivery fails.
      </Body>
      {error && <Notice kind="error">{error}</Notice>}
      {data?.length === 0 && <Notice>No compute contracts listed yet. Providers create them in the portal.</Notice>}
      {data?.map((r) => {
        const live = now >= r.s.deliveryStart && now < r.s.deliveryEnd;
        return (
          <Pressable key={String(r.s.id)} onPress={() => router.push(`/market/${r.s.id}`)}>
            <Card>
              <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "700" }}>{seriesLabel(r.s)}</Body>
                  <Label>
                    {r.provider || "Provider"} · reliability {pct(r.reliability)} {live ? "· delivering now" : ""}
                  </Label>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Mono size={18}>{r.last ? r.last.toFixed(3) : "—"}</Mono>
                  <Label>AUSD / GPU-hr</Label>
                </View>
              </Row>
              <Row style={{ justifyContent: "space-between" }}>
                <Mono color={c.bid}>Bid {r.bid?.toFixed(3) ?? "—"}</Mono>
                <Mono color={c.ask}>Ask {r.ask?.toFixed(3) ?? "—"}</Mono>
                <Mono color={c.dim}>Index {r.index > 0n ? fmt(r.index, AUSD_DECIMALS, 3) : "—"}</Mono>
              </Row>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
