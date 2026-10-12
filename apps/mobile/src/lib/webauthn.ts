import type { WebAuthnClient } from "@category-labs/mera";

/** Web: Mera's built-in browser client (navigator.credentials) is used when this is undefined. */
export const webAuthnClient: WebAuthnClient | undefined = undefined;
