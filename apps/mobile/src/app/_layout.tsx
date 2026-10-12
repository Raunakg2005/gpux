import "@/lib/polyfills";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { c } from "@/components/ui";
import { AccountProvider } from "@/state/account";

export default function RootLayout() {
  return (
    <AccountProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboard" options={{ headerShown: false }} />
        <Stack.Screen name="market/[id]" options={{ title: "Market" }} />
        <Stack.Screen name="deposit" options={{ title: "Deposit from any chain" }} />
      </Stack>
    </AccountProvider>
  );
}
