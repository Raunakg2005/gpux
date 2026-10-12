import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, ScrollView, View } from "react-native";
import { parseUnits } from "viem";
import { Body, Button, c, Card, Input, Label, Mono, Notice, Row, Segmented } from "@/components/ui";
import { short } from "@/lib/format";
import { useWallet } from "@/state/account";
import { useAction } from "@/state/usePoll";

type Asset = { assetId: string; chain: string; symbol: string; decimals: number; price?: number };
type Quote = { depositAddress: string | null; depositMemo: string | null; amountInFormatted: string; amountOutFormatted: string; timeEstimate: number; deadline: string | null };
type Status = { status: string; amountOutFormatted: string | null; destinationTx: { hash: string; explorerUrl: string } | null };

const API = process.env.EXPO_PUBLIC_INTENTS_URL ?? (Platform.OS === "web" ? "/api/intents" : "");
const CHAIN_NAMES: Record<string, string> = { base: "Base", arb: "Arbitrum", eth: "Ethereum", sol: "Solana", bsc: "BNB Chain", pol: "Polygon", btc: "Bitcoin", near: "NEAR" };
const TARGETS = ["USDC", "MON"] as const;

/**
 * Any-chain deposits into Monad with Aurora Intents (NEAR Intents 1Click): send from 30+ chains to a
 * one-time deposit address; solvers deliver USDC or MON to the same passkey address on Monad mainnet.
 */
export default function Deposit() {
  const { account } = useWallet();
  const [assets, setAssets] = useState<{ origins: Asset[]; destinations: Asset[] } | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const [target, setTarget] = useState<(typeof TARGETS)[number]>("USDC");
  const [amount, setAmount] = useState("10");
  const [refundTo, setRefundTo] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const preview = useAction();
  const create = useAction();

  useEffect(() => {
    fetch(`${API}?op=tokens`)
      .then((r) => r.json())
      .then((j) => {
        setAssets(j);
        setOrigin(j.origins[0]?.assetId ?? "");
      })
      .catch(() => setAssets({ origins: [], destinations: [] }));
  }, []);

  const from = assets?.origins.find((a) => a.assetId === origin);
  const to = assets?.destinations.find((a) => a.symbol === target);
  const evmOrigin = from ? ["base", "arb", "eth", "bsc", "pol"].includes(from.chain) : true;

  const requestQuote = async (dry: boolean) => {
    if (!from || !to) throw new Error("Pick a source asset");
    const res = await fetch(`${API}?op=quote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dry,
        originAssetId: from.assetId,
        destinationAssetId: to.assetId,
        amount: parseUnits(amount || "0", from.decimals).toString(),
        recipient: account.address,
        refundTo: evmOrigin ? account.address : refundTo,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `Quote failed (${res.status})`);
    return body as Quote;
  };

  // Poll the 1Click status once a deposit address exists.
  useEffect(() => {
    if (!quote?.depositAddress) return;
    const id = setInterval(async () => {
      try {
        const s = (await (await fetch(`${API}?op=status&depositAddress=${quote.depositAddress}`)).json()) as Status;
        if (s.status) setStatus(s);
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [quote?.depositAddress]);

  const originsByChain = useMemo(() => assets?.origins ?? [], [assets]);
  const done = status?.status === "SUCCESS";

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
      <Body dim style={{ marginBottom: 12 }}>
        Fund your account from any chain. Aurora Intents (NEAR Intents) solvers deliver to your passkey address on Monad mainnet,
        usually in under a minute. Same address, no bridge UI.
      </Body>

      <Card>
        <Label>From</Label>
        <Row style={{ flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {originsByChain.map((a) => (
            <View key={a.assetId} style={{ width: 108 }}>
              <Button
                title={`${a.symbol} · ${CHAIN_NAMES[a.chain] ?? a.chain}`}
                kind={a.assetId === origin ? "primary" : "ghost"}
                onPress={() => {
                  setOrigin(a.assetId);
                  setQuote(null);
                  setStatus(null);
                }}
              />
            </View>
          ))}
        </Row>
        {!assets && <Notice>Loading supported assets…</Notice>}
        <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" suffix={from?.symbol} />
        {!evmOrigin && (
          <Input label={`Refund address on ${CHAIN_NAMES[from?.chain ?? ""] ?? "origin chain"}`} value={refundTo} onChangeText={setRefundTo} autoCapitalize="none" />
        )}
        <Label>To (Monad)</Label>
        <Segmented options={TARGETS} value={target} onChange={(v) => (setTarget(v), setQuote(null))} />
        <Label>Recipient</Label>
        <Mono>{account.address}</Mono>
        <View style={{ marginTop: 10, gap: 8 }}>
          <Button
            title="Preview quote"
            kind="ghost"
            busy={preview.busy}
            onPress={() =>
              preview.run(async () => {
                const q = await requestQuote(true);
                setQuote(q);
                return `${q.amountInFormatted} ${from?.symbol} → ${q.amountOutFormatted} ${target} on Monad (~${q.timeEstimate}s)`;
              })
            }
          />
          <Button
            title="Get deposit address"
            busy={create.busy}
            disabled={!evmOrigin && !refundTo}
            onPress={() =>
              create.run(async () => {
                setStatus(null);
                setQuote(await requestQuote(false));
              })
            }
          />
        </View>
        {preview.error && <Notice kind="error">{preview.error}</Notice>}
        {preview.ok && <Notice kind="ok">{preview.ok}</Notice>}
        {create.error && <Notice kind="error">{create.error}</Notice>}
      </Card>

      {quote?.depositAddress && (
        <Card>
          <Label>Send exactly</Label>
          <Mono size={20}>
            {quote.amountInFormatted} {from?.symbol}
          </Mono>
          <Label style={{ marginTop: 8 }}>on {CHAIN_NAMES[from?.chain ?? ""] ?? from?.chain} to</Label>
          <Mono size={13}>{quote.depositAddress}</Mono>
          {quote.depositMemo && <Mono size={13}>memo: {quote.depositMemo}</Mono>}
          <Notice>
            You receive ≈ {quote.amountOutFormatted} {target} at {short(account.address)} on Monad. Address valid until{" "}
            {quote.deadline ? new Date(quote.deadline).toLocaleTimeString() : "the deadline"}; if the swap can't complete you are refunded on
            the origin chain.
          </Notice>
          <Label style={{ marginTop: 8 }}>Status</Label>
          <Mono color={done ? c.bid : status?.status === "FAILED" || status?.status === "REFUNDED" ? c.ask : c.warn}>
            {status?.status ?? "PENDING_DEPOSIT"}
            {status?.amountOutFormatted ? ` · ${status.amountOutFormatted} ${target} delivered` : ""}
          </Mono>
          {status?.destinationTx && (
            <View style={{ marginTop: 8 }}>
              <Button title="View on Monad explorer" kind="ghost" onPress={() => Linking.openURL(status.destinationTx!.explorerUrl)} />
            </View>
          )}
        </Card>
      )}
      <Notice>Powered by Aurora Intents · NEAR Intents 1Click. Deposits settle on Monad mainnet; GPUx markets run on testnet during the hackathon.</Notice>
    </ScrollView>
  );
}
