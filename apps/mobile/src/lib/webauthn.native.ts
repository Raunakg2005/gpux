import type { WebAuthnClient } from "@category-labs/mera";
import { reactNativeWebAuthnClient } from "@category-labs/mera/react-native-webauthn-client";

/** iOS/Android: platform passkeys via react-native-passkey (needs a dev build, not Expo Go). */
export const webAuthnClient: WebAuthnClient | undefined = reactNativeWebAuthnClient;
