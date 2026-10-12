import { Redirect, Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { c } from "@/components/ui";
import { useAccount } from "@/state/account";

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;

export default function TabsLayout() {
  const { account } = useAccount();
  if (!account) return <Redirect href="/onboard" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.dim,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Markets", tabBarIcon: icon("◧") }} />
      <Tabs.Screen name="hedge" options={{ title: "Hedge", tabBarIcon: icon("⇅") }} />
      <Tabs.Screen name="portfolio" options={{ title: "Portfolio", tabBarIcon: icon("◎") }} />
      <Tabs.Screen name="risk" options={{ title: "Risk", tabBarIcon: icon("△") }} />
      <Tabs.Screen name="vault" options={{ title: "Vault", tabBarIcon: icon("⚿") }} />
      <Tabs.Screen name="copilot" options={{ title: "Copilot", tabBarIcon: icon("✦") }} />
    </Tabs>
  );
}
