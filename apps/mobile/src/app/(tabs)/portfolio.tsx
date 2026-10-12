import { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { parseUnits } from "viem";
import { Body, Button, c, Card, Input, Label, Mono, Notice, Row, Stat } from "@/components/ui";
import { AUSD_HAS_FAUCET, EXPLORER, gpux } from "@/lib/config";
import { AUSD_DECIMALS, ausdBalance, faucetAusd, GPU_HOUR_DECIMALS, listSeries, myRedemptions, seriesLabel, tokenBalance } from "@/lib/gpux";
import { depositToMargin, marginBalance } from "@/lib/kuru";
import { fmt, short } from "@/lib/format";
import { useAccount, useWallet } from "@/state/account";
import { useAction, usePoll } from "@/state/usePoll";

export default function Portfolio() {
  const { account, wallet } = useWallet();
  const { signOut } = useAccount();
  const [fund, setFund] = useState("");
  const faucet = useAction();
  const deposit = useAction();

  const { data, error } = usePoll(async () => {
    const [ausd, margin, series, redemptions] = await Promise.all([
      ausdBalance(account.address),
      marginBalance(account.address, gpux.ausd),
      listSeries(),
      myRedemptions(account.address),
    ]);
    const holdings = (await Promise.all(series.map(async (s) => ({ s, bal: await tokenBalance(s.token, account.address) })))).filter(
      (h) => h.bal > 0n,
    );
    return { ausd, margin, holdings, redemptions, series };
  }, 2000);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Row style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <View>
            <Label>Account</Label>
            <Mono>{short(account.address)}</Mono>
          </View>
          <View style={{ width: 120 }}>
            <Button title="Explorer" kind="ghost" onPress={() => Linking.openURL(`${EXPLORER}/address/${account.address}`)} />
          </View>
        </Row>
        <Row>
          <Stat label="Wallet AUSD" value={data ? fmt(data.ausd, AUSD_DECIMALS) : "—"} />
          <Stat label="Trading AUSD" value={data ? fmt(data.margin, AUSD_DECIMALS) : "—"} />
        </Row>
      </Card>

      <Card>
        <Label>Fund trading (Kuru margin)</Label>
        <Body dim style={{ marginBottom: 8 }}>
          Limit orders rest on Kuru and draw from this balance.
        </Body>
        <Input value={fund} onChangeText={setFund} keyboardType="decimal-pad" placeholder="100" suffix="AUSD" />
        <Row>
          <Button
            title="Move to trading"
            busy={deposit.busy}
            disabled={!fund}
            onPress={() =>
              deposit.run(async () => {
                await depositToMargin(wallet, gpux.ausd, parseUnits(fund.replace(/,/g, ""), AUSD_DECIMALS));
                setFund("");
                return "Funded";
              })
            }
          />
          {AUSD_HAS_FAUCET && (
            <Button
              title="Testnet AUSD"
              kind="ghost"
              busy={faucet.busy}
              onPress={() =>
                faucet.run(async () => {
                  await faucetAusd(wallet);
                  return "+1,000 AUSD";
                })
              }
            />
          )}
        </Row>
        {(deposit.error || faucet.error) && <Notice kind="error">{deposit.error || faucet.error}</Notice>}
        {(deposit.ok || faucet.ok) && <Notice kind="ok">{deposit.ok || faucet.ok}</Notice>}
      </Card>

      <Card>
        <Label>Compute positions</Label>
        {error && <Notice kind="error">{error}</Notice>}
        {data?.holdings.length === 0 && <Notice>No GPU-hours yet. Buy some in Markets.</Notice>}
        {data?.holdings.map(({ s, bal }) => (
          <Row key={String(s.id)} style={{ justifyContent: "space-between", paddingVertical: 6 }}>
            <Body>{seriesLabel(s)}</Body>
            <Mono>{fmt(bal, GPU_HOUR_DECIMALS)} hr</Mono>
          </Row>
        ))}
      </Card>

      <Card>
        <Label>Deliveries</Label>
        {data?.redemptions.length === 0 && <Notice>No redemptions yet.</Notice>}
        {data?.redemptions.map((r) => {
          const s = data.series.find((x) => x.id === r.seriesId);
          const color = r.status === "Delivered" ? c.bid : r.status === "Failed" ? c.ask : c.warn;
          return (
            <Row key={String(r.id)} style={{ justifyContent: "space-between", paddingVertical: 6 }}>
              <Body>
                #{String(r.id)} · {s ? `${s.gpuType} ${s.region}` : `series ${r.seriesId}`} · {fmt(r.amount, GPU_HOUR_DECIMALS)} hr
              </Body>
              <Mono color={color}>{r.status === "Failed" ? "Bond paid you" : r.status}</Mono>
            </Row>
          );
        })}
      </Card>

      <Button title="Sign out" kind="ghost" onPress={signOut} />
    </ScrollView>
  );
}
