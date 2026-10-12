// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockAUSD} from "../src/MockAUSD.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";
import {SLABondVault} from "../src/SLABondVault.sol";
import {ComputeContractFactory} from "../src/ComputeContractFactory.sol";
import {DeliveryEscrow} from "../src/DeliveryEscrow.sol";
import {ComputeIndex} from "../src/ComputeIndex.sol";
import {GPUxCREReceiver} from "../src/GPUxCREReceiver.sol";

contract GPUxCREReceiverTest is Test {
    MockAUSD ausd;
    ProviderRegistry registry;
    SLABondVault vault;
    ComputeContractFactory factory;
    DeliveryEscrow escrow;
    ComputeIndex index;
    GPUxCREReceiver receiver;

    address forwarder = makeAddr("forwarder");
    address provider = makeAddr("provider");
    address buyer = makeAddr("buyer");
    uint256 seriesId;

    function setUp() public {
        ausd = new MockAUSD();
        registry = new ProviderRegistry();
        vault = new SLABondVault(IERC20(address(ausd)));
        factory = new ComputeContractFactory(vault, registry);
        escrow = new DeliveryEscrow(factory, vault, registry);
        index = new ComputeIndex();
        receiver = new GPUxCREReceiver(forwarder, escrow, index);

        vault.setManager(address(factory), true);
        vault.setManager(address(escrow), true);
        factory.setEscrow(address(escrow));
        registry.setReporter(address(escrow), true);
        escrow.setOracle(address(receiver));
        index.setPublisher(address(receiver));

        vm.startPrank(provider);
        registry.register("NeoCloud", "");
        ausd.faucet(provider, 1_000e6);
        ausd.approve(address(vault), type(uint256).max);
        vault.deposit(1_000e6);
        seriesId = factory.createSeries(
            "H100", "US-EAST", uint64(block.timestamp + 1 days), uint64(block.timestamp + 8 days), 1e6, 1_000e18, "H"
        );
        factory.mintCapacity(seriesId, 10e18, buyer);
        vm.stopPrank();
    }

    function _report(uint8 action, bytes memory payload) internal pure returns (bytes memory) {
        return abi.encode(action, payload);
    }

    function test_settleViaReport() public {
        vm.prank(buyer);
        uint256 id = escrow.redeem(seriesId, 4e18, "");
        vm.prank(forwarder);
        receiver.onReport("", _report(1, abi.encode(id, false)));
        assertEq(ausd.balanceOf(buyer), 4e6); // bond slashed to buyer
    }

    function test_publishViaReport() public {
        bytes32[] memory keys = new bytes32[](1);
        uint128[] memory prices = new uint128[](1);
        keys[0] = keccak256(abi.encode("H100", "US-EAST"));
        prices[0] = 2_150_000;
        vm.prank(forwarder);
        receiver.onReport("", _report(2, abi.encode(keys, prices)));
        (uint128 price,) = index.latest(keys[0]);
        assertEq(price, 2_150_000);
    }

    function test_rejectsNonForwarder() public {
        vm.expectRevert();
        receiver.onReport("", _report(1, abi.encode(uint256(0), true)));
    }
}
