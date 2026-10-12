// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockAUSD} from "../src/MockAUSD.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";
import {SLABondVault} from "../src/SLABondVault.sol";
import {ComputeContractFactory} from "../src/ComputeContractFactory.sol";
import {DeliveryEscrow} from "../src/DeliveryEscrow.sol";
import {ComputeIndex} from "../src/ComputeIndex.sol";

/// Usage: forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
/// Set AUSD_ADDRESS to use real AUSD; otherwise a MockAUSD is deployed.
/// Set CRE_FORWARDER to the CRE workflow sender; defaults to the deployer.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address ausd = vm.envOr("AUSD_ADDRESS", address(0));
        address cre = vm.envOr("CRE_FORWARDER", deployer);

        vm.startBroadcast(pk);
        if (ausd == address(0)) ausd = address(new MockAUSD());

        ProviderRegistry registry = new ProviderRegistry();
        SLABondVault vault = new SLABondVault(IERC20(ausd));
        ComputeContractFactory factory = new ComputeContractFactory(vault, registry);
        DeliveryEscrow escrow = new DeliveryEscrow(factory, vault, registry);
        ComputeIndex index = new ComputeIndex();

        vault.setManager(address(factory), true);
        vault.setManager(address(escrow), true);
        factory.setEscrow(address(escrow));
        registry.setReporter(address(escrow), true);
        escrow.setOracle(cre);
        index.setPublisher(cre);
        vm.stopBroadcast();

        string memory o = "deploy";
        vm.serializeAddress(o, "ausd", ausd);
        vm.serializeAddress(o, "providerRegistry", address(registry));
        vm.serializeAddress(o, "slaBondVault", address(vault));
        vm.serializeAddress(o, "computeFactory", address(factory));
        vm.serializeAddress(o, "deliveryEscrow", address(escrow));
        vm.serializeAddress(o, "computeIndex", address(index));
        string memory json = vm.serializeAddress(o, "cre", cre);
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));

        console2.log("AUSD", ausd);
        console2.log("ProviderRegistry", address(registry));
        console2.log("SLABondVault", address(vault));
        console2.log("ComputeContractFactory", address(factory));
        console2.log("DeliveryEscrow", address(escrow));
        console2.log("ComputeIndex", address(index));
    }
}
