import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";

export const c = {
  bg: "#07090d",
  card: "#10141b",
  cardAlt: "#161b24",
  border: "#232a36",
  text: "#e8ecf2",
  dim: "#8b95a7",
  faint: "#5b6575",
  accent: "#7c5cff",
  bid: "#22c55e",
  ask: "#ef4444",
  warn: "#f59e0b",
};

export function Screen({ children }: { children: ReactNode }) {
  return <View style={s.screen}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={s.h1}>{children}</Text>;
}

export function Label({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

export function Body({ children, dim, style }: { children: ReactNode; dim?: boolean; style?: object }) {
  return <Text style={[s.body, dim && { color: c.dim }, style]}>{children}</Text>;
}

export function Mono({ children, color, size = 14 }: { children: ReactNode; color?: string; size?: number }) {
  return <Text style={{ color: color ?? c.text, fontSize: size, fontVariant: ["tabular-nums"], fontFamily: "Menlo" }}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}

export function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Label>{label}</Label>
      <Mono color={color} size={17}>
        {value}
      </Mono>
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = "primary",
  busy,
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "buy" | "sell" | "ghost";
  busy?: boolean;
  disabled?: boolean;
}) {
  const bg = { primary: c.accent, buy: c.bid, sell: c.ask, ghost: "transparent" }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        kind === "ghost" && { borderWidth: 1, borderColor: c.border },
      ]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string; suffix?: string }) {
  const { label, suffix, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 10 }}>
      {label ? <Label>{label}</Label> : null}
      <View style={s.inputWrap}>
        <TextInput placeholderTextColor={c.faint} style={[s.input, style]} {...rest} />
        {suffix ? <Text style={{ color: c.dim, marginLeft: 6 }}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.segment}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} style={[s.segmentItem, value === o && { backgroundColor: c.cardAlt }]}>
          <Text style={{ color: value === o ? c.text : c.dim, fontWeight: "600" }}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "ok"; children: ReactNode }) {
  const color = { info: c.dim, error: c.ask, ok: c.bid }[kind];
  return <Text style={{ color, marginVertical: 6, fontSize: 13 }}>{children}</Text>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  h1: { color: c.text, fontSize: 26, fontWeight: "800", marginBottom: 4 },
  label: { color: c.dim, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  body: { color: c.text, fontSize: 15, lineHeight: 21 },
  card: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  button: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, flexGrow: 1 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 12,
  },
  input: { flex: 1, color: c.text, fontSize: 16, height: 44 },
  segment: { flexDirection: "row", backgroundColor: c.card, borderRadius: 10, padding: 3, marginBottom: 10 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
});
