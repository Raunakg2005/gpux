import { ScrollView } from "react-native";
import { formatUnits } from "viem";
import { Body, c, Card, Label, Mono, Notice, Row, Stat } from "@/components/ui";
import { AUSD_DECIMALS, bondStatus, getProvider, GPU_HOUR_DECIMALS, indexPrice, listSeries, seriesLabel, tokenBalance } from "@/lib/gpux";
import { estLiquidationPrice, getContext, getPositions, hasApiKey, unscale } from "@/lib/perpl";
import { pct, usd } from "@/lib/format";
import { useWallet } from "@/state/account";
import { usePoll } from "@/state/usePoll";

/** Portfolio risk: compute exposure, delivery risk (bond coverage x provider reliability), and perp hedge health. */
export default function Risk() {
  const { account } = useWallet();

  const { data, error } = usePoll(async () => {
    const series = await listSeries();
    const compute = (
      await Promise.all(
        series.map(async (s) => {
          const bal = await tokenBalance(s.token, account.address);
          if (bal === 0n) return null;
          const [idx, provider, bond] = await Promise.all([indexPrice(s.gpuType, s.region), getProvider(s.provider), bondStatus(s)]);
          const hours = Number(formatUnits(bal, GPU_HOUR_DECIMALS));
          const price = Number(formatUnits(idx.price, AUSD_DECIMALS));
          const bondPerHour = bond.supply > 0n ? Number(formatUnits(bond.locked, AUSD_DECIMALS)) / Number(formatUnits(bond.supply, GPU_HOUR_DECIMALS)) : 0;
          return { s, hours, value: hours * price, price, coverage: price > 0 ? bondPerHour / price : 0, reliability: provider.reliabilityBps };
        }),
      )
    ).filter((x) => x !== null);

    let perps: { label: string; notional: number; short: boolean; liqDistance: number }[] = [];
    if (await hasApiKey()) {
      const [ctx, pos] = await Promise.all([getContext(), getPositions().catch(() => ({ d: [] }))]);
      perps = pos.d.flatMap((p) => {
        const m = ctx.markets.find((x) => x.id === p.mkt);
        if (!m?.state?.mrk) return [];
        const mark = unscale(m.state.mrk, m.config.price_decimals);
        const liq = estLiquidationPrice(p, m);
        return [{ label: `${p.sd === 1 ? "Long" : "Short"} ${m.symbol} ${p.lv / 100}x`, notional: mark * unscale(p.s, m.config.size_decimals), short: p.sd === 2, liqDistance: Math.abs(mark - liq) / mark }];
      });
    }
    return { compute, perps };
  }, 3000);

  const computeValue = data?.compute.reduce((a, x) => a + x.value, 0) ?? 0;
  const hedged = data?.perps.filter((p) => p.short).reduce((a, p) => a + p.notional, 0) ?? 0;
  const ratio = computeValue > 0 ? hedged / computeValue : 0;
  const worstLiq = data?.perps.length ? Math.min(...data.perps.map((p) => p.liqDistance)) : null;
  const score = Math.round(
    100 *
      Math.min(1, (data?.compute.length ? Math.min(...data.compute.map((x) => Math.min(1, x.coverage) * (x.reliability / 10_000))) : 1)) *
      (worstLiq === null ? 1 : Math.min(1, worstLiq / 0.2)),
  );

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
      {error && <Notice kind="error">{error}</Notice>}
      <Card>
        <Label>Portfolio health</Label>
        <Mono size={40} color={score >= 70 ? c.bid : score >= 40 ? c.warn : c.ask}>
          {data ? score : "—"}
        </Mono>
        <Body dim>Combines bond coverage, provider reliability and distance to liquidation.</Body>
      </Card>

      <Card>
        <Row>
          <Stat label="Compute value" value={usd(computeValue)} />
          <Stat label="Hedged" value={pct(ratio * 10_000)} color={ratio > 1.1 ? c.warn : c.text} />
          <Stat label="Nearest liq." value={worstLiq === null ? "—" : pct(worstLiq * 10_000)} color={worstLiq !== null && worstLiq < 0.1 ? c.ask : c.text} />
        </Row>
      </Card>

      <Card>
        <Label>Delivery risk</Label>
        {data?.compute.length === 0 && <Notice>No compute positions.</Notice>}
        {data?.compute.map((x) => (
          <Row key={String(x.s.id)} style={{ justifyContent: "space-between", paddingVertical: 6 }}>
            <Body style={{ flex: 1 }}>{seriesLabel(x.s)}</Body>
            <Mono color={x.coverage >= 0.5 ? c.bid : c.warn}>bond {pct(x.coverage * 10_000)}</Mono>
            <Mono color={x.reliability >= 9500 ? c.bid : c.warn}> · rel {pct(x.reliability)}</Mono>
          </Row>
        ))}
        <Notice>Bond coverage = slashable bond per hour ÷ index price. 100% means a failed delivery is fully refunded.</Notice>
      </Card>

      <Card>
        <Label>Perp positions</Label>
        {data?.perps.length === 0 && <Notice>No perps open.</Notice>}
        {data?.perps.map((p, i) => (
          <Row key={i} style={{ justifyContent: "space-between", paddingVertical: 6 }}>
            <Body>{p.label}</Body>
            <Mono color={p.liqDistance < 0.1 ? c.ask : c.dim}>
              {usd(p.notional)} · {pct(p.liqDistance * 10_000)} to liq
            </Mono>
          </Row>
        ))}
        <Notice>Liquidation prices are estimates (5% maintenance margin assumed).</Notice>
      </Card>
    </ScrollView>
  );
}
