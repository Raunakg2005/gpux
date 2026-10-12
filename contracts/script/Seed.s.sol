// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockAUSD} from "../src/MockAUSD.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";
import {SLABondVault} from "../src/SLABondVault.sol";
import {ComputeContractFactory} from "../src/ComputeContractFactory.sol";
import {ComputeIndex} from "../src/ComputeIndex.sol";

/// Seeds a demo provider, bonds, compute series and index prices on top of Deploy.s.sol output.
/// The deployer acts as the provider and as the CRE publisher, and receives the minted capacity
/// so the Kuru market script can quote it.
/// Usage: forge script script/Seed.s.sol --rpc-url monad_testnet --broadcast
contract Seed is Script {
    uint256 constant CAPACITY = 2_000e18; // GPU-hours minted per series
    uint64 constant WEEK = 7 days;

    MockAUSD ausd;
    ProviderRegistry registry;
    SLABondVault vault;
    ComputeContractFactory factory;
    ComputeIndex index;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address me = vm.addr(pk);
        _load();
        uint64 start0 = uint64((block.timestamp / WEEK + 1) * WEEK); // next week boundary

        vm.startBroadcast(pk);
        registry.register("NeoCloud Labs", "https://gpux.example.com/providers/neocloud.json");
        ausd.faucet(me, 50_000e6);
        ausd.approve(address(vault), type(uint256).max);
        vault.deposit(20_000e6);

        _series(me, "H100", "US-EAST", start0, 2_100_000, "H100-USE-W1");
        _series(me, "H100", "EU-WEST", start0, 2_300_000, "H100-EUW-W1");
        _series(me, "A100", "US-EAST", start0 + WEEK, 1_200_000, "A100-USE-W2");
        _series(me, "B200", "US-WEST", start0 + 2 * WEEK, 3_600_000, "B200-USW-W3");
        vm.stopBroadcast();
    }

    function _load() internal {
        string memory json = vm.readFile(string.concat("./deployments/", vm.toString(block.chainid), ".json"));
        ausd = MockAUSD(vm.parseJsonAddress(json, ".ausd"));
        registry = ProviderRegistry(vm.parseJsonAddress(json, ".providerRegistry"));
        vault = SLABondVault(vm.parseJsonAddress(json, ".slaBondVault"));
        factory = ComputeContractFactory(vm.parseJsonAddress(json, ".computeFactory"));
        index = ComputeIndex(vm.parseJsonAddress(json, ".computeIndex"));
    }

    /// @param priceMicro AUSD per GPU-hour (6 decimals); the bond is 50% of it.
    function _series(address me, string memory gpu, string memory region, uint64 start, uint256 priceMicro, string memory symbol)
        internal
    {
        uint256 id = factory.createSeries(gpu, region, start, start + WEEK, priceMicro / 2, 10_000e18, symbol);
        factory.mintCapacity(id, CAPACITY, me);
        index.publish(keccak256(abi.encode(gpu, region)), uint128(priceMicro));
        console2.log(symbol, address(factory.series(id).token));
    }
}
