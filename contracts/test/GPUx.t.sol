// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockAUSD} from "../src/MockAUSD.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";
import {SLABondVault} from "../src/SLABondVault.sol";
import {ComputeContractFactory} from "../src/ComputeContractFactory.sol";
import {DeliveryEscrow} from "../src/DeliveryEscrow.sol";

contract GPUxTest is Test {
    MockAUSD ausd;
    ProviderRegistry registry;
    SLABondVault vault;
    ComputeContractFactory factory;
    DeliveryEscrow escrow;

    address provider = makeAddr("provider");
    address buyer = makeAddr("buyer");
    address oracle = makeAddr("oracle");

    uint256 constant BOND_PER_HOUR = 0.5e6; // 0.50 AUSD bonded per GPU-hour
    uint256 seriesId;

    function setUp() public {
        ausd = new MockAUSD();
        registry = new ProviderRegistry();
        vault = new SLABondVault(IERC20(address(ausd)));
        factory = new ComputeContractFactory(vault, registry);
        escrow = new DeliveryEscrow(factory, vault, registry);

        vault.setManager(address(factory), true);
        vault.setManager(address(escrow), true);
        factory.setEscrow(address(escrow));
        registry.setReporter(address(escrow), true);
        escrow.setOracle(oracle);

        vm.startPrank(provider);
        registry.register("NeoCloud", "ipfs://meta");
        ausd.faucet(provider, 1_000e6);
        ausd.approve(address(vault), type(uint256).max);
        vault.deposit(1_000e6);
        seriesId = factory.createSeries(
            "H100", "US-EAST", uint64(block.timestamp + 7 days), uint64(block.timestamp + 14 days), BOND_PER_HOUR, 1_000e18, "H100-USE-W43"
        );
        factory.mintCapacity(seriesId, 100e18, buyer);
        vm.stopPrank();
    }

    function test_mintLocksBond() public view {
        assertEq(vault.lockedBond(provider, seriesId), 50e6);
        assertEq(vault.freeBond(provider), 950e6);
        assertEq(IERC20(address(factory.series(seriesId).token)).balanceOf(buyer), 100e18);
    }

    function test_deliveredReleasesBond() public {
        vm.prank(buyer);
        uint256 id = escrow.redeem(seriesId, 40e18, "");
        vm.prank(oracle);
        escrow.settle(id, true);
        assertEq(vault.lockedBond(provider, seriesId), 30e6);
        assertEq(vault.freeBond(provider), 970e6);
        assertEq(registry.reliabilityBps(provider), 10_000);
    }

    function test_failedSlashesToBuyer() public {
        vm.prank(buyer);
        uint256 id = escrow.redeem(seriesId, 40e18, "");
        vm.prank(oracle);
        escrow.settle(id, false);
        assertEq(ausd.balanceOf(buyer), 20e6);
        assertEq(registry.reliabilityBps(provider), 0);
    }

    function test_onlyOracleSettles() public {
        vm.prank(buyer);
        uint256 id = escrow.redeem(seriesId, 1e18, "");
        vm.expectRevert("only oracle");
        escrow.settle(id, true);
    }
}
