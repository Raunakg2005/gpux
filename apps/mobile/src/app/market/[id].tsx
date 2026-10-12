import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Body, Button, c, Card, Input, Label, Mono, Notice, Row, Segmented, Stat } from "@/components/ui";
import { OrderBookView } from "@/components/OrderBookView";
import { KURU_MARKETS } from "@/lib/config";
import { AUSD_DECIMALS, bondStatus, getProvider, GPU_HOUR_DECIMALS, listSeries, redeem, seriesLabel, tokenBalance } from "@/lib/gpux";
import { estimateBuy, estimateSell, getL2Book, getMarketParams, placeLimit, placeMarket } from "@/lib/kuru";
import { sealSecret } from "@/lib/mera";
import { fmt, pct } from "@/lib/format";
import { storage } from "@/lib/storage";
import { useWallet } from "@/state/account";
import { useAction, usePoll } from "@/state/usePoll";

const SIDES = ["Buy", "Sell"] as const;
const TYPES = ["Market", "Limit"] as const;

export default function MarketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { account, wallet } = useWallet();
  const [side, setSide] = useState<(typeof SIDES)[number]>("Buy");
  const [type, setType] = useState<(typeof TYPES)[number]>("Market");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [redeemHours, setRedeemHours] = useState("");
  const trade = useAction();
  const redemption = useAction();

  const { data } = usePoll(
    async () => {
      const s = (await listSeries()).find((x) => String(x.id) === id);
      if (!s) throw new Error("Unknown contract");
      const market = KURU_MARKETS[s.token.toLowerCase()];
      const [book, params, held, provider, bond] = await Promise.all([
        market ? getL2Book(market) : null,
        market ? getMarketParams(market) : null,
        tokenBalance(s.token, account.address),
        getProvider(s.provider),
        bondStatus(s),
      ]);
      return { s, market, book, params, held, provider, bond };
    },
    1000,
    [id],
  );

  const preview = useMemo(() => {
    if (!data?.book || !amount) return null;
    const n = Number(amount);
    if (!(n > 0)) return null;
    if (type === "Limit") return `${side === "Buy" ? "Bid" : "Offer"} ${n} GPU-hr @ ${price || "?"} = ${(n * Number(price || 0)).toFixed(2)} AUSD`;
    return side === "Buy"
      ? `≈ ${estimateBuy(data.book, n).toFixed(3)} GPU-hr for ${n} AUSD`
      : `≈ ${estimateSell(data.book, n).toFixed(2)} AUSD for ${n} GPU-hr`;
  }, [data?.book, amount, price, side, type]);

  if (!data) return <Notice>Loading…</Notice>;
  const { s, market, book, params, held, provider, bond } = data;
  const coverage = bond.supply > 0n ? Number((bond.locked * 10n ** 18n) / bond.supply) / 10 ** AUSD_DECIMALS : 0;

  const submit = () =>
    trade.run(async () => {
      if (!market) throw new Error("No Kuru market for this contract yet");
      if (type === "Market") {
        await placeMarket(wallet, market, { isBuy: side === "Buy", amount, slippageBps: 100 });
      } else {
        await placeLimit(wallet, market, { isBuy: side === "Buy", price, size: amount, postOnly: true });
      }
      setAmount("");
      return `${side} order settled onchain`;
    });

  const doRedeem = () =>
    redemption.run(async () => {
      const token = crypto.getRandomValues(new Uint8Array(32));
      const vault = await sealSecret(token);
      await redeem(wallet, s.id, redeemHours, token);
      const sealed = (await storage.getJSON<unknown[]>("gpux.accessVaults")) ?? [];
      await storage.setJSON("gpux.accessVaults", [...sealed, { seriesId: String(s.id), hours: redeemHours, vault }]);
      setRedeemHours("");
      return "Redemption requested. Your access token is sealed to your passkey (see Vault).";
    });

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: `${s.gpuType} ${s.region}` }} />
      <Body style={{ fontWeight: "700" }}>{seriesLabel(s)}</Body>
      <Label>
        Delivery {new Date(s.deliveryStart * 1000).toLocaleDateString()} → {new Date(s.deliveryEnd * 1000).toLocaleDateString()}
      </Label>

      <Card style={{ marginTop: 12 }}>
        <Row>
          <Stat label="Provider" value={provider.name || "—"} />
          <Stat label="Reliability" value={pct(provider.reliabilityBps)} color={provider.reliabilityBps >= 9500 ? c.bid : c.warn} />
          <Stat label="Bond / hr" value={`$${coverage.toFixed(2)}`} />
        </Row>
        <Notice>If the provider fails to deliver, the bond is slashed and paid to you automatically.</Notice>
      </Card>

      <Card>
        {book ? <OrderBookView book={book} /> : <Notice>This contract isn't listed on Kuru yet.</Notice>}
        {params && <Label style={{ marginTop: 6 }}>Kuru fees: taker {params.takerFeeBps} bps · maker {params.makerFeeBps} bps</Label>}
      </Card>

      <Card>
        <Segmented options={SIDES} value={side} onChange={setSide} />
        <Segmented options={TYPES} value={type} onChange={setType} />
        {type === "Limit" && <Input label="Limit price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" suffix="AUSD/hr" />}
        <Input
          label={type === "Market" && side === "Buy" ? "Spend" : "Size"}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          suffix={type === "Market" && side === "Buy" ? "AUSD" : "GPU-hr"}
        />
        {preview && <Mono color={c.dim}>{preview}</Mono>}
        {type === "Limit" && <Notice>Limit orders rest on Kuru and draw from your Kuru margin balance (Portfolio → Fund trading).</Notice>}
        {type === "Market" && <Notice>Max slippage 1%. Fills settle in the next block.</Notice>}
        <View style={{ marginTop: 8 }}>
          <Button title={`${side} ${s.gpuType} hours`} kind={side === "Buy" ? "buy" : "sell"} busy={trade.busy} onPress={submit} />
        </View>
        {trade.error && <Notice kind="error">{trade.error}</Notice>}
        {trade.ok && <Notice kind="ok">{trade.ok}</Notice>}
      </Card>

      <Card>
        <Label>Take delivery</Label>
        <Body dim style={{ marginBottom: 8 }}>
          You hold {fmt(held, GPU_HOUR_DECIMALS)} GPU-hours. Redeem them to receive compute access during the delivery window.
        </Body>
        <Input label="Hours to redeem" value={redeemHours} onChangeText={setRedeemHours} keyboardType="decimal-pad" suffix="GPU-hr" />
        <Button title="Redeem for compute" kind="ghost" busy={redemption.busy} disabled={!redeemHours} onPress={doRedeem} />
        {redemption.error && <Notice kind="error">{redemption.error}</Notice>}
        {redemption.ok && <Notice kind="ok">{redemption.ok}</Notice>}
      </Card>
    </ScrollView>
  );
}
