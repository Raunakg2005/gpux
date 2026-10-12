import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Body, Button, c, Card, Input, Label, Mono, Notice, Row, Segmented, Stat } from "@/components/ui";
import { perpl } from "@/lib/config";
import { AUSD_DECIMALS } from "@/lib/gpux";
import {
  enrollApiKey,
  estLiquidationPrice,
  getContext,
  getPositions,
  getWallet,
  hasApiKey,
  OrderType,
  placeOrder,
  setupExchangeAccount,
  unscale,
  type PerplMarket,
} from "@/lib/perpl";
import { useWallet } from "@/state/account";
import { useAction, usePoll } from "@/state/usePoll";

const SIDES = ["Long", "Short"] as const;

/** Perps on Perpl: hedge the dollar value of compute positions, or trade directly. */
export default function Hedge() {
  const { account, wallet } = useWallet();
  const [marketId, setMarketId] = useState<number | null>(null);
  const [side, setSide] = useState<(typeof SIDES)[number]>("Short");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState("3");
  const [collateral, setCollateral] = useState(perpl.minAccountOpen);
  const setup = useAction();
  const order = useAction();

  const { data, error, refresh } = usePoll(async () => {
    const [ctx, enrolled] = await Promise.all([getContext(), hasApiKey()]);
    if (!enrolled) return { ctx, enrolled, accounts: [], positions: [] };
    const [w, p] = await Promise.all([getWallet().catch(() => null), getPositions().catch(() => null)]);
    return { ctx, enrolled, accounts: w?.accounts ?? [], positions: p?.d ?? [] };
  }, 3000);

  const markets = data?.ctx.markets ?? [];
  const market: PerplMarket | undefined = markets.find((m) => m.id === marketId) ?? markets[0];
  const acct = data?.accounts[0];
  const mark = market?.state?.mrk ? unscale(market.state.mrk, market.config.price_decimals) : null;

  const submit = () =>
    order.run(async () => {
      if (!market || !acct) throw new Error("Finish account setup first");
      await placeOrder({
        market,
        account: acct.id,
        type: side === "Long" ? OrderType.OpenLong : OrderType.OpenShort,
        size: Number(size),
        leverage: Number(leverage),
        slippageBps: 50,
      });
      setSize("");
      refresh();
      return `${side} ${size} ${market.symbol} sent to Perpl`;
    });

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
      <Body dim style={{ marginBottom: 12 }}>
        Perpetual futures on Perpl, margined in AUSD. Use them to hedge the value of your compute book, or trade directly.
      </Body>
      {error && <Notice kind="error">{error}</Notice>}

      {data && (!data.enrolled || !acct?.fw) && (
        <Card>
          <Label>One-time setup</Label>
          <Body dim style={{ marginBottom: 8 }}>
            1. Authorize a trading key with your passkey. 2. Open a Perpl account (min 100 AUSD of Perpl testnet collateral) and allow order forwarding.
          </Body>
          {!data.enrolled ? (
            <Button
              title="Authorize trading key"
              busy={setup.busy}
              onPress={() =>
                setup.run(async () => {
                  await enrollApiKey(account);
                  refresh();
                  return "Trading key enrolled";
                })
              }
            />
          ) : (
            <>
              <Input label="Collateral" value={collateral} onChangeText={setCollateral} keyboardType="decimal-pad" suffix="AUSD" />
              <Button
                title="Open Perpl account"
                busy={setup.busy}
                onPress={() =>
                  setup.run(async () => {
                    await setupExchangeAccount(wallet, perpl.collateral, collateral, AUSD_DECIMALS);
                    refresh();
                    return "Account ready";
                  })
                }
              />
            </>
          )}
          {setup.error && <Notice kind="error">{setup.error}</Notice>}
          {setup.ok && <Notice kind="ok">{setup.ok}</Notice>}
        </Card>
      )}

      <Card>
        <Row style={{ flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {markets.map((m) => (
            <View key={m.id} style={{ width: 72 }}>
              <Button title={m.symbol} kind={m.id === market?.id ? "primary" : "ghost"} onPress={() => setMarketId(m.id)} />
            </View>
          ))}
        </Row>
        <Row style={{ marginBottom: 10 }}>
          <Stat label="Mark" value={mark ? mark.toLocaleString() : "—"} />
          <Stat label="Balance" value={acct ? unscale(acct.b, AUSD_DECIMALS).toFixed(2) : "—"} />
        </Row>
        <Segmented options={SIDES} value={side} onChange={setSide} />
        <Input label="Size" value={size} onChangeText={setSize} keyboardType="decimal-pad" suffix={market?.symbol} />
        <Input label="Leverage" value={leverage} onChangeText={setLeverage} keyboardType="decimal-pad" suffix="x" />
        {mark && size ? (
          <Mono color={c.dim}>
            Notional ≈ {(mark * Number(size)).toFixed(2)} · margin ≈ {((mark * Number(size)) / Number(leverage || 1)).toFixed(2)} AUSD
          </Mono>
        ) : null}
        <Notice>Market order, max slippage 0.5%. Liquidation risk rises with leverage.</Notice>
        <Button title={`${side} ${market?.symbol ?? ""}`} kind={side === "Long" ? "buy" : "sell"} busy={order.busy} disabled={!acct?.fw || !size} onPress={submit} />
        {order.error && <Notice kind="error">{order.error}</Notice>}
        {order.ok && <Notice kind="ok">{order.ok}</Notice>}
      </Card>

      <Card>
        <Label>Open positions</Label>
        {data?.positions.length === 0 && <Notice>No open positions.</Notice>}
        {data?.positions.map((p) => {
          const m = markets.find((x) => x.id === p.mkt);
          if (!m) return null;
          return (
            <Row key={p.pid} style={{ justifyContent: "space-between", paddingVertical: 6 }}>
              <Mono color={p.sd === 1 ? c.bid : c.ask}>
                {p.sd === 1 ? "LONG" : "SHORT"} {unscale(p.s, m.config.size_decimals)} {m.symbol} {p.lv / 100}x
              </Mono>
              <Mono color={c.dim}>
                entry {unscale(p.ep, m.config.price_decimals).toFixed(2)} · liq ~{estLiquidationPrice(p, m).toFixed(2)}
              </Mono>
            </Row>
          );
        })}
      </Card>
    </ScrollView>
  );
}
