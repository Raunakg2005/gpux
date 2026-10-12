import { Platform } from "react-native";
import * as ExpoCrypto from "expo-crypto";

// Hermes has no crypto.getRandomValues; Mera and noble need it. Must load before Mera.
if (Platform.OS !== "web") {
  const g = globalThis as { crypto?: Partial<Crypto> };
  g.crypto ??= {};
  g.crypto.getRandomValues ??= (<T extends ArrayBufferView | null>(array: T): T => {
    ExpoCrypto.getRandomValues(array as unknown as Uint8Array);
    return array;
  }) as Crypto["getRandomValues"];
}
