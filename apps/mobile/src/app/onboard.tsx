import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Body, Button, c, Card, H1, Input, Label, Notice } from "@/components/ui";
import { describeMeraError, hasKnownPasskey } from "@/lib/mera";
import { useAccount } from "@/state/account";

export default function Onboard() {
  const { create, signIn } = useAccount();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"create" | "signin" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    hasKnownPasskey().then(setReturning);
  }, []);

  const go = async (kind: "create" | "signin") => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "create") await create(name.trim() || "GPUx trader");
      else await signIn();
      router.replace("/");
    } catch (e) {
      setError(describeMeraError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
        <Label style={{ color: c.accent }}>GPUx</Label>
        <H1>Trade GPU compute like a commodity</H1>
        <Body dim style={{ marginBottom: 24 }}>
          Buy and sell bonded H100 hours, hedge with perps, settle in under a second on Monad.
        </Body>

        <Card>
          <Label>Your account is a passkey</Label>
          <Body dim style={{ marginBottom: 12 }}>
            Face ID, Touch ID or your device PIN. No seed phrase, no extension, nothing held by us.
          </Body>
          {!returning && <Input label="Name on this passkey" placeholder="e.g. Ana @ NeoCloud" value={name} onChangeText={setName} />}
          <View style={{ gap: 10 }}>
            {returning ? (
              <>
                <Button title="Sign in with passkey" busy={busy === "signin"} onPress={() => go("signin")} />
                <Button title="Create a new account" kind="ghost" busy={busy === "create"} onPress={() => setReturning(false)} />
              </>
            ) : (
              <>
                <Button title="Create account" busy={busy === "create"} onPress={() => go("create")} />
                <Button title="I already have a passkey" kind="ghost" busy={busy === "signin"} onPress={() => go("signin")} />
              </>
            )}
          </View>
          {error && <Notice kind="error">{error}</Notice>}
        </Card>
        <Notice>Powered by Mera · keys derived on-device from your passkey (WebAuthn PRF)</Notice>
      </View>
    </SafeAreaView>
  );
}
