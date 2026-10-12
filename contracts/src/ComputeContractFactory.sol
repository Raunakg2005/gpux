// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ComputeToken} from "./ComputeToken.sol";
import {SLABondVault} from "./SLABondVault.sol";
import {ProviderRegistry} from "./ProviderRegistry.sol";

/// @notice Creates standardized compute contract series and mints bonded capacity.
contract ComputeContractFactory is Ownable {
    struct Series {
        address provider;
        ComputeToken token;
        string gpuType; // "H100"
        string region; // "US-EAST"
        uint64 deliveryStart; // unix seconds
        uint64 deliveryEnd;
        uint256 bondPerHour; // AUSD (6 decimals) locked per 1e18 token units
        uint256 maxSupply; // token units
    }

    SLABondVault public immutable vault;
    ProviderRegistry public immutable registry;
    address public escrow;

    Series[] internal _series;

    event SeriesCreated(
        uint256 indexed seriesId, address indexed provider, address token, string gpuType, string region, uint64 deliveryStart
    );
    event CapacityMinted(uint256 indexed seriesId, address indexed to, uint256 amount, uint256 bondLocked);

    constructor(SLABondVault vault_, ProviderRegistry registry_) Ownable(msg.sender) {
        vault = vault_;
        registry = registry_;
    }

    function setEscrow(address escrow_) external onlyOwner {
        escrow = escrow_;
    }

    function createSeries(
        string calldata gpuType,
        string calldata region,
        uint64 deliveryStart,
        uint64 deliveryEnd,
        uint256 bondPerHour,
        uint256 maxSupply,
        string calldata symbol
    ) external returns (uint256 seriesId) {
        require(registry.isActive(msg.sender), "provider not active");
        require(deliveryEnd > deliveryStart && deliveryStart > block.timestamp, "bad window");
        require(bondPerHour > 0, "bond required");

        seriesId = _series.length;
        ComputeToken token = new ComputeToken(string.concat(gpuType, "-HR ", region), symbol, seriesId);
        _series.push(Series(msg.sender, token, gpuType, region, deliveryStart, deliveryEnd, bondPerHour, maxSupply));
        _emitCreated(seriesId);
    }

    function _emitCreated(uint256 seriesId) internal {
        Series storage s = _series[seriesId];
        emit SeriesCreated(seriesId, s.provider, address(s.token), s.gpuType, s.region, s.deliveryStart);
    }

    /// @notice Provider mints capacity tokens; the matching bond is locked in the vault.
    function mintCapacity(uint256 seriesId, uint256 amount, address to) external {
        Series storage s = _series[seriesId];
        require(msg.sender == s.provider, "not provider");
        require(block.timestamp < s.deliveryStart, "delivery started");
        require(s.token.totalSupply() + amount <= s.maxSupply, "max supply");
        uint256 bond = bondFor(seriesId, amount);
        vault.lock(s.provider, seriesId, bond);
        s.token.mint(to, amount);
        emit CapacityMinted(seriesId, to, amount, bond);
    }

    function burnForRedemption(uint256 seriesId, address from, uint256 amount) external {
        require(msg.sender == escrow, "only escrow");
        _series[seriesId].token.burnFrom(from, amount);
    }

    function bondFor(uint256 seriesId, uint256 amount) public view returns (uint256) {
        return (_series[seriesId].bondPerHour * amount) / 1e18;
    }

    function series(uint256 seriesId) external view returns (Series memory) {
        return _series[seriesId];
    }

    function seriesCount() external view returns (uint256) {
        return _series.length;
    }
}
