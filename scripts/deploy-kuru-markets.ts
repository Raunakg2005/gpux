/**
 * Lists every GPUx compute series on Kuru (ComputeToken/AUSD spot order book), seeds a
 * maker ladder around the ComputeIndex price, and writes apps/mobile/.env.
 *
 *   cd scripts && npm i && npm run kuru:markets
 *
 * Env (gpux/.env): DEPLOYER_PRIVATE_KEY, MONAD_RPC_URL, optional KURU_ROUTER, KURU_MARGIN_ACCOUNT.
 * Safe to re-run: markets already recorded in deployments/<chainId>.kuru.json are reused.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ethers } from "ethers";
import * as Kuru from "@kuru-labs/kuru-sdk";

config({ path: resolve("..", ".env") });

const RPC = process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const ROUTER = process.env.KURU_ROUTER ?? "0x7EFbE105Ca7415dE98F96622173458ac1c054630";
const MARGIN = process.env.KURU_MARGIN_ACCOUNT ?? "0xd029C2D98ff85D8F64799017fE00a59B1159CE02";
const LEVELS = 5; // per side
const STEP = 0.01; // 1% between levels
const LEVEL_SIZE = 40; // GPU-hours per level

const factoryAbi = [
  "function seriesCount() view returns (uint256)",
  "function series(uint256) view returns (tuple(address provider, address token, string gpuType, string region, uint64 deliveryStart, uint64 deliveryEnd, uint256 bondPerHour, uint256 maxSupply))",
];
const indexAbi = ["function latest(bytes32) view returns (uint128 price, uint64 timestamp)"];
const erc20Abi = ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"];
const marginAbi = ["function deposit(address _user, address _token, uint256 _amount) payable"];

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY missing in gpux/.env");
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(pk, provider);
  const me = await signer.getAddress();
  const { chainId } = await provider.getNetwork();

  const deployPath = resolve("..", "contracts", "deployments", `${chainId}.json`);
  const kuruPath = resolve("..", "contracts", "deployments", `${chainId}.kuru.json`);
  const d = JSON.parse(readFileSync(deployPath, "utf8"));
  const markets: Record<string, string> = existsSync(kuruPath) ? JSON.parse(readFileSync(kuruPath, "utf8")) : {};

  const factory = new ethers.Contract(d.computeFactory, factoryAbi, provider);
  const index = new ethers.Contract(d.computeIndex, indexAbi, provider);
  const count = (await factory.seriesCount()).toNumber();
  const creator = new Kuru.ParamCreator();

  for (let i = 0; i < count; i++) {
    const s = await factory.series(i);
    const token: string = s.token.toLowerCase();
    const key = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string", "string"], [s.gpuType, s.region]));
    const price = Number(ethers.utils.formatUnits((await index.latest(key)).price, 6)) || 1;

    if (!markets[token]) {
      // Tick 10 bps of price, min order 0.1 GPU-hour, max price 10x index.
      const p = creator.calculatePrecisions(price, 1, price * 10, 0.1, 10);
      const market = await creator.deployMarket(
        signer,
        ROUTER,
        0,
        s.token,
        d.ausd,
        p.sizePrecision,
        p.pricePrecision,
        p.tickSize,
        p.minSize,
        p.maxSize,
        30,
        10,
        ethers.BigNumber.from(100),
      );
      markets[token] = market;
      writeFileSync(kuruPath, JSON.stringify(markets, null, 2));
      console.log(`listed ${s.gpuType} ${s.region} -> ${market}`);
    }

    await seedLadder(signer, me, markets[token], s.token, d.ausd, price);
  }

  writeMobileEnv(d, markets);
  console.log("wrote apps/mobile/.env");
}

/** Deposit inventory into Kuru margin and post LEVELS bids and asks around the index. */
async function seedLadder(signer: ethers.Wallet, me: string, market: string, base: string, quote: string, price: number) {
  const params = await Kuru.ParamFetcher.getMarketParams(signer.provider as ethers.providers.JsonRpcProvider, market);
  // Snap in integer price units: tick sizes like 36 (= 0.0036) are not powers of ten.
  const pp = params.pricePrecision.toNumber();
  const tick = params.tickSize.toNumber();
  const snap = (x: number) => ((Math.round((x * pp) / tick) * tick) / pp).toFixed(Math.round(Math.log10(pp)));

  const baseNeed = ethers.utils.parseUnits(String(LEVELS * LEVEL_SIZE), 18);
  const quoteNeed = ethers.utils.parseUnits((LEVELS * LEVEL_SIZE * price * 1.2).toFixed(6), 6);
  for (const [token, amount] of [
    [base, baseNeed],
    [quote, quoteNeed],
  ] as const) {
    const erc20 = new ethers.Contract(token, erc20Abi, signer);
    await (await erc20.approve(MARGIN, amount)).wait();
    await (await new ethers.Contract(MARGIN, marginAbi, signer).deposit(me, token, amount)).wait();
  }

  for (let l = 1; l <= LEVELS; l++) {
    for (const isBuy of [true, false]) {
      const px = snap(price * (isBuy ? 1 - STEP * l : 1 + STEP * l));
      await Kuru.GTC.placeLimit(signer, market, params, { price: px, size: String(LEVEL_SIZE), isBuy, postOnly: true });
    }
  }
  console.log(`  seeded ${LEVELS}x2 levels around ${price}`);
}

function writeMobileEnv(d: Record<string, string>, markets: Record<string, string>) {
  const lines = [
    `EXPO_PUBLIC_RPC_URL=${RPC}`,
    `EXPO_PUBLIC_AUSD=${d.ausd}`,
    `EXPO_PUBLIC_AUSD_FAUCET=true`,
    `EXPO_PUBLIC_PROVIDER_REGISTRY=${d.providerRegistry}`,
    `EXPO_PUBLIC_SLA_BOND_VAULT=${d.slaBondVault}`,
    `EXPO_PUBLIC_COMPUTE_FACTORY=${d.computeFactory}`,
    `EXPO_PUBLIC_DELIVERY_ESCROW=${d.deliveryEscrow}`,
    `EXPO_PUBLIC_COMPUTE_INDEX=${d.computeIndex}`,
    `EXPO_PUBLIC_KURU_MARKETS=${JSON.stringify(markets)}`,
    `EXPO_PUBLIC_PERPL_API=https://testnet.perpl.xyz/api`,
    `EXPO_PUBLIC_PERPL_ENROLL_API=https://testnet.perpl.xyz/api`,
  ];
  writeFileSync(resolve("..", "apps", "mobile", ".env"), lines.join("\n") + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
