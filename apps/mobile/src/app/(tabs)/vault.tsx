import { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { bytesToHex } from "viem";
import type { PasskeySecretVault } from "@category-labs/mera";
import { Body, Button, c, Card, Input, Label, Mono, Notice, Row } from "@/components/ui";
import { describeMeraError, openSecret, sealSecret } from "@/lib/mera";
import { storage } from "@/lib/storage";

type Note = { title: string; createdAt: number; vault: PasskeySecretVault };
type AccessVault = { seriesId: string; hours: string; vault: PasskeySecretVault };

/**
 * Mera "One Passkey, Many Keys": the same passkey that signs trades also seals private
 * procurement notes, sealed bids and compute access tokens. Each item has its own PRF salt.
 */
export default function Vault() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [access, setAccess] = useState<AccessVault[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [opened, setOpened] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setNotes((await storage.getJSON<Note[]>("gpux.notes")) ?? []);
    setAccess((await storage.getJSON<AccessVault[]>("gpux.accessVaults")) ?? []);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const attempt = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(describeMeraError(e));
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    attempt("save", async () => {
      const vault = await sealSecret(new TextEncoder().encode(body));
      const next = [{ title: title || "Untitled", createdAt: Date.now(), vault }, ...notes];
      await storage.setJSON("gpux.notes", next);
      setTitle("");
      setBody("");
      setNotes(next);
    });

  const open = (key: string, vault: PasskeySecretVault, asHex = false) =>
    attempt(key, async () => {
      const bytes = await openSecret(vault);
      setOpened((o) => ({ ...o, [key]: asHex ? bytesToHex(bytes) : new TextDecoder().decode(bytes) }));
    });

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
      <Body dim style={{ marginBottom: 12 }}>
        Private notes, sealed bids and compute access keys, encrypted with keys derived from your passkey. Nothing readable leaves this
        device.
      </Body>
      {error && <Notice kind="error">{error}</Notice>}

      <Card>
        <Label>New sealed note</Label>
        <Input placeholder="e.g. Max bid for Nov H100s" value={title} onChangeText={setTitle} />
        <Input placeholder="Contents" value={body} onChangeText={setBody} multiline style={{ height: 80 }} />
        <Button title="Seal with passkey" busy={busy === "save"} disabled={!body} onPress={save} />
      </Card>

      <Card>
        <Label>Compute access keys</Label>
        {access.length === 0 && <Notice>Redeem GPU-hours to receive an access key.</Notice>}
        {access.map((a, i) => {
          const key = `a${i}`;
          return (
            <Row key={key} style={{ justifyContent: "space-between", paddingVertical: 6 }}>
              <Body style={{ flex: 1 }}>
                Series {a.seriesId} · {a.hours} hr
              </Body>
              {opened[key] ? (
                <Mono size={11}>{opened[key].slice(0, 18)}…</Mono>
              ) : (
                <Button title="Reveal" kind="ghost" busy={busy === key} onPress={() => open(key, a.vault, true)} />
              )}
            </Row>
          );
        })}
      </Card>

      <Card>
        <Label>Sealed notes</Label>
        {notes.length === 0 && <Notice>No notes yet.</Notice>}
        {notes.map((n) => {
          const key = `n${n.createdAt}`;
          return (
            <Card key={key} style={{ backgroundColor: c.cardAlt }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Body style={{ fontWeight: "700", flex: 1 }}>{n.title}</Body>
                {!opened[key] && <Button title="Unlock" kind="ghost" busy={busy === key} onPress={() => open(key, n.vault)} />}
              </Row>
              {opened[key] && <Body style={{ marginTop: 6 }}>{opened[key]}</Body>}
            </Card>
          );
        })}
      </Card>
    </ScrollView>
  );
}
