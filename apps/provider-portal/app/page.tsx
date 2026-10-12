// Provider portal: register, post AUSD bond, create series, mint capacity, list on Kuru,
// track redemptions and slashing. Contracts: ProviderRegistry, SLABondVault, ComputeContractFactory.
export default function ProviderHome() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>GPUx Provider Portal</h1>
      <ol>
        <li>Register your cloud</li>
        <li>Post SLA bond (AUSD)</li>
        <li>Create a compute series (GPU, region, delivery week)</li>
        <li>Mint capacity and list it on Kuru</li>
        <li>Track deliveries, reliability score and payouts</li>
      </ol>
    </main>
  );
}
