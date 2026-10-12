// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DeliveryEscrow} from "../src/DeliveryEscrow.sol";
import {ComputeIndex} from "../src/ComputeIndex.sol";
import {GPUxCREReceiver} from "../src/GPUxCREReceiver.sol";

/// Deploys the CRE report receiver and makes it the escrow oracle + index publisher.
/// CRE_FORWARDER defaults to the Monad testnet MOCK forwarder used by `cre workflow simulate --broadcast`
/// (from `cre workflow supported-chains`). For a deployed workflow, call setForwarderAddress with
/// the real forwarder 0xF8344CFd5c43616a4366C34E3EEE75af79a74482.
contract DeployCRE is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address forwarder = vm.envOr("CRE_FORWARDER", address(0xB9F79d863261869B234c481D1f9A7af84AeAd192));
        string memory path = string.concat("./deployments/", vm.toString(block.chainid), ".json");
        string memory json = vm.readFile(path);
        DeliveryEscrow escrow = DeliveryEscrow(vm.parseJsonAddress(json, ".deliveryEscrow"));
        ComputeIndex index = ComputeIndex(vm.parseJsonAddress(json, ".computeIndex"));

        vm.startBroadcast(pk);
        GPUxCREReceiver receiver = new GPUxCREReceiver(forwarder, escrow, index);
        escrow.setOracle(address(receiver));
        index.setPublisher(address(receiver));
        vm.stopBroadcast();

        vm.writeJson(vm.toString(address(receiver)), path, ".creReceiver");
        console2.log("GPUxCREReceiver", address(receiver));
    }
}
