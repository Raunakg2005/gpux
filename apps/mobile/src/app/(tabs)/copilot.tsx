import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Body, Button, c, Card, Input, Label, Notice } from "@/components/ui";

type Intent = { action: "buy" | "sell" | "none"; market?: string; seriesId?: number; amount?: number };
type Turn = { role: "user" | "copilot"; text: string; intent?: Intent };

const COPILOT_URL = process.env.EXPO_PUBLIC_COPILOT_URL ?? (Platform.OS === "web" ? "/api/copilot" : "");

const EXAMPLES = ["Cheapest GPU-hours right now?", "Get me 10 H100 hours in Europe", "Is B200 priced above its index?"];

/** Kimi-powered copilot: suggests orders, never executes them. The user reviews and signs with their passkey. */
export default function Copilot() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (message: string) => {
    if (!message.trim() || !COPILOT_URL) return;
    setBusy(true);
    setError(null);
    setTurns((t) => [...t, { role: "user", text: message }]);
    setInput("");
    try {
      const res = await fetch(COPILOT_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Copilot error ${res.status}`);
      setTurns((t) => [...t, { role: "copilot", text: body.reply, intent: body.intent }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
      <Body dim style={{ marginBottom: 12 }}>
        Ask in plain English. The copilot (Kimi) reads live Kuru prices and the Chainlink index, then suggests an order you review and
        sign yourself.
      </Body>
      {turns.length === 0 && (
        <View style={{ gap: 8, marginBottom: 12 }}>
          {EXAMPLES.map((e) => (
            <Button key={e} title={e} kind="ghost" onPress={() => ask(e)} />
          ))}
        </View>
      )}
      {turns.map((t, i) => (
        <Card key={i} style={t.role === "user" ? { backgroundColor: c.cardAlt } : undefined}>
          <Label>{t.role === "user" ? "You" : "Copilot · Kimi"}</Label>
          <Body>{t.text}</Body>
          {t.intent && t.intent.action !== "none" && t.intent.seriesId !== undefined && (
            <View style={{ marginTop: 10 }}>
              <Button
                title={`Review: ${t.intent.action} ${t.intent.market} (${t.intent.action === "buy" ? `${t.intent.amount} AUSD` : `${t.intent.amount} hr`})`}
                kind={t.intent.action === "buy" ? "buy" : "sell"}
                onPress={() =>
                  router.push({ pathname: "/market/[id]", params: { id: String(t.intent!.seriesId), side: t.intent!.action, amount: String(t.intent!.amount) } })
                }
              />
            </View>
          )}
        </Card>
      ))}
      {error && <Notice kind="error">{error}</Notice>}
      <Input placeholder="e.g. buy 5 A100 hours" value={input} onChangeText={setInput} onSubmitEditing={() => ask(input)} />
      <Button title="Ask copilot" busy={busy} disabled={!input.trim()} onPress={() => ask(input)} />
    </ScrollView>
  );
}
