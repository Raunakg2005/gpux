import { parseAbi } from "viem";

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
]);

export const mockAusdAbi = parseAbi(["function faucet(address to, uint256 amount)"]);

export const factoryAbi = parseAbi([
  "struct Series { address provider; address token; string gpuType; string region; uint64 deliveryStart; uint64 deliveryEnd; uint256 bondPerHour; uint256 maxSupply; }",
  "function seriesCount() view returns (uint256)",
  "function series(uint256 seriesId) view returns (Series)",
  "function bondFor(uint256 seriesId, uint256 amount) view returns (uint256)",
]);

export const registryAbi = parseAbi([
  "function providers(address) view returns (string name, string metadataURI, bool active, uint64 deliveriesOk, uint64 deliveriesFailed)",
  "function reliabilityBps(address provider) view returns (uint256)",
]);

export const bondVaultAbi = parseAbi(["function lockedBond(address provider, uint256 seriesId) view returns (uint256)"]);

export const escrowAbi = parseAbi([
  "function redeem(uint256 seriesId, uint256 amount, bytes accessCommitment) returns (uint256)",
  "function redemptionCount() view returns (uint256)",
  "function redemptions(uint256) view returns (uint256 seriesId, address buyer, uint256 amount, bytes accessCommitment, uint8 status)",
]);

export const indexAbi = parseAbi(["function latest(bytes32 key) view returns (uint128 price, uint64 timestamp)"]);

/** Subset of Kuru OrderBook / MarginAccount ABIs (from @kuru-labs/kuru-sdk abi/). */
export const kuruOrderBookAbi = parseAbi([
  "function getMarketParams() view returns (uint32, uint96, address, uint256, address, uint256, uint32, uint96, uint96, uint256, uint256)",
  "function getL2Book() view returns (bytes)",
  "function bestBidAsk() view returns (uint256, uint256)",
  "function addBuyOrder(uint32 _price, uint96 size, bool _postOnly)",
  "function addSellOrder(uint32 _price, uint96 size, bool _postOnly)",
  "function placeAndExecuteMarketBuy(uint96 _quoteSize, uint256 _minAmountOut, bool _isMargin, bool _isFillOrKill) payable returns (uint256)",
  "function placeAndExecuteMarketSell(uint96 _size, uint256 _minAmountOut, bool _isMargin, bool _isFillOrKill) payable returns (uint256)",
  "function batchCancelOrders(uint40[] _orderIds)",
  "event OrderCreated(uint40 orderId, address owner, uint96 size, uint32 price, bool isBuy)",
  "event Trade(uint40 orderId, address makerAddress, bool isBuy, uint256 price, uint96 updatedSize, address takerAddress, address txOrigin, uint96 filledSize)",
]);

export const kuruMarginAbi = parseAbi([
  "function deposit(address _user, address _token, uint256 _amount) payable",
  "function withdraw(uint256 _amount, address _token)",
  "function getBalance(address _user, address _token) view returns (uint256)",
]);

/** Perpl exchange account setup (api-docs README). */
export const perplExchangeAbi = parseAbi([
  "function createAccount(uint256 amount)",
  "function allowOrderForwarding(bool allow)",
]);
