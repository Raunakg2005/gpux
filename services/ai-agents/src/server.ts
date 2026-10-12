/**
 * AI layer. Both Kimi (Moonshot) and Qwen (Alibaba DashScope) expose OpenAI-compatible
 * APIs, so one client shape serves both. Confirm base URLs and model ids in their docs.
 *
 * - copilot (Kimi): natural language -> structured order intent for the mobile app.
 * - procurement agent (Qwen 3.8 Max): autonomously sources N GPU-hours under a budget,
 *   splitting into TWAP/limit orders on Kuru and hedging on Perpl via tool calls.
 */
import OpenAI from "openai";

export const kimi = new OpenAI({ apiKey: process.env.KIMI_API_KEY, baseURL: process.env.KIMI_BASE_URL });
export const qwen = new OpenAI({ apiKey: process.env.QWEN_API_KEY, baseURL: process.env.QWEN_BASE_URL });

export type OrderIntent = {
  side: "buy" | "sell";
  gpuType: string;
  region: string;
  gpuHours: number;
  maxPriceAusd?: number;
  strategy: "market" | "limit" | "twap" | "budget";
  hedgeRatio?: number;
};

// TODO: HTTP server (POST /copilot, POST /procure) with tool definitions for
// getIndexPrice, getOrderBook, placeOrder, hedge — executed by the user's Mera account.
