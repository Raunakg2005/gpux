import {
	bytesToHex,
	consensusIdenticalAggregation,
	cre,
	getNetwork,
	json,
	ok,
	TxStatus,
	type HTTPSendRequester,
	type Runtime,
} from '@chainlink/cre-sdk'
import { type Address, type Hex, encodeAbiParameters, keccak256, parseAbiParameters } from 'viem'
import { z } from 'zod'
import { ComputeContractFactory } from '../contracts/evm/ts/generated/ComputeContractFactory'
import {
	DeliveryEscrow,
	type DecodedLog,
	type RedemptionRequestedDecoded,
} from '../contracts/evm/ts/generated/DeliveryEscrow'
import { GPUxCREReceiver } from '../contracts/evm/ts/generated/GPUxCREReceiver'
import { KuruOrderBook } from '../contracts/evm/ts/generated/KuruOrderBook'

/**
 * GPUx orchestration workflow.
 *
 * Trigger 0 (EVM log, DeliveryEscrow.RedemptionRequested): every node fetches the provider's
 * telemetry, nodes agree on a verdict, and a DON-signed report settles the redemption through
 * GPUxCREReceiver (delivered -> bond released, failed -> bond slashed to the buyer).
 *
 * Trigger 1 (cron): reads best bid/ask on every Kuru compute market, takes the mid, and
 * publishes it to ComputeIndex in one report.
 */
export const configSchema = z.object({
	schedule: z.string(),
	chainSelectorName: z.string(),
	escrow: z.string(),
	factory: z.string(),
	receiver: z.string(),
	telemetryUrl: z.string(),
	markets: z.array(z.object({ gpuType: z.string(), region: z.string(), orderBook: z.string() })),
})
type Config = z.infer<typeof configSchema>

const ACTION_SETTLE = 1
const ACTION_PUBLISH = 2
/** Kuru bestBidAsk() is 1e18-scaled; ComputeIndex stores AUSD with 6 decimals. */
const KURU_TO_INDEX = 10n ** 12n
/** settle() makes several external calls (~180k gas); the default report gas is too low. */
const REPORT_GAS_LIMIT = '1000000'

type Telemetry = {
	slaUptimeBps: number
	providers: Record<string, { uptimeBps: number; failedRedemptions?: number[] }>
}

function evmClient(config: Config) {
	const network = getNetwork({ chainFamily: 'evm', chainSelectorName: config.chainSelectorName, isTestnet: true })
	if (!network) throw new Error(`Network not found: ${config.chainSelectorName}`)
	return new cre.capabilities.EVMClient(network.chainSelector.selector)
}

function sendReport(runtime: Runtime<Config>, action: number, payload: Hex): string {
	const receiver = new GPUxCREReceiver(evmClient(runtime.config), runtime.config.receiver as Address)
	const report = encodeAbiParameters(parseAbiParameters('uint8 action, bytes payload'), [action, payload])
	const result = receiver.writeReport(runtime, report, { gasLimit: REPORT_GAS_LIMIT })
	if (result.txStatus !== TxStatus.SUCCESS) {
		throw new Error(`Report write failed: ${result.errorMessage || result.txStatus}`)
	}
	// The forwarder tx can succeed while our receiver reverts (e.g. out of gas); 1 = REVERTED.
	if (result.receiverContractExecutionStatus === 1) {
		throw new Error('GPUxCREReceiver reverted while processing the report')
	}
	return bytesToHex(result.txHash || new Uint8Array(32))
}

/** Runs on each node: 1 if the provider met its SLA for this redemption, else 0. */
const fetchVerdict = (sendRequester: HTTPSendRequester, url: string, provider: string, redemptionId: number): number => {
	const response = sendRequester.sendRequest({ url, method: 'GET' }).result()
	if (!ok(response)) throw new Error(`Telemetry request failed: ${response.statusCode}`)
	const telemetry = json(response) as Telemetry
	const p = telemetry.providers[provider.toLowerCase()]
	if (!p) return 0
	const failed = p.failedRedemptions?.includes(redemptionId) ?? false
	return p.uptimeBps >= telemetry.slaUptimeBps && !failed ? 1 : 0
}

export const onRedemption = (runtime: Runtime<Config>, log: DecodedLog<RedemptionRequestedDecoded>): string => {
	const { id, seriesId, buyer, amount } = log.data
	runtime.log(`RedemptionRequested #${id}: series ${seriesId}, ${amount} units, buyer ${buyer}`)

	const client = evmClient(runtime.config)
	const status = new DeliveryEscrow(client, runtime.config.escrow as Address).redemptions(runtime, id)[4]
	if (status !== 1) {
		runtime.log(`Redemption #${id} is not pending (status ${status}); nothing to do`)
		return 'skipped'
	}
	const series = new ComputeContractFactory(client, runtime.config.factory as Address).series(runtime, seriesId)
	runtime.log(`Provider ${series.provider}, ${series.gpuType} ${series.region}`)

	const http = new cre.capabilities.HTTPClient()
	const verdict = http
		.sendRequest(runtime, fetchVerdict, consensusIdenticalAggregation<number>())(
			runtime.config.telemetryUrl,
			series.provider,
			Number(id),
		)
		.result()
	const delivered = verdict === 1
	runtime.log(`Consensus verdict: ${delivered ? 'DELIVERED (release bond)' : 'FAILED (slash bond to buyer)'}`)

	const tx = sendReport(runtime, ACTION_SETTLE, encodeAbiParameters(parseAbiParameters('uint256, bool'), [id, delivered]))
	runtime.log(`Settled #${id} in tx ${tx}`)
	return `${delivered ? 'delivered' : 'slashed'}:${tx}`
}

export const onPublishIndex = (runtime: Runtime<Config>): string => {
	const client = evmClient(runtime.config)
	const keys: Hex[] = []
	const prices: bigint[] = []
	for (const m of runtime.config.markets) {
		const [bid, ask] = new KuruOrderBook(client, m.orderBook as Address).bestBidAsk(runtime)
		if (bid === 0n || ask === 0n) {
			runtime.log(`${m.gpuType} ${m.region}: one-sided book, skipped`)
			continue
		}
		const mid = (bid + ask) / 2n / KURU_TO_INDEX
		runtime.log(`${m.gpuType} ${m.region}: bid ${bid} ask ${ask} -> index ${mid}`)
		keys.push(keccak256(encodeAbiParameters(parseAbiParameters('string, string'), [m.gpuType, m.region])))
		prices.push(mid)
	}
	if (keys.length === 0) return 'no prices'
	const tx = sendReport(runtime, ACTION_PUBLISH, encodeAbiParameters(parseAbiParameters('bytes32[], uint128[]'), [keys, prices]))
	runtime.log(`Published ${keys.length} index prices in tx ${tx}`)
	return `published:${keys.length}:${tx}`
}

export function initWorkflow(config: Config) {
	const escrow = new DeliveryEscrow(evmClient(config), config.escrow as Address)
	const cron = new cre.capabilities.CronCapability()
	return [
		cre.handler(escrow.logTriggerRedemptionRequested(), onRedemption),
		cre.handler(cron.trigger({ schedule: config.schedule }), onPublishIndex),
	]
}
