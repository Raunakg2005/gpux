// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice One standardized compute contract, e.g. H100-HR / US-EAST / 2026-W43.
/// 1e18 units = 1 GPU-hour. Only the factory mints and burns.
contract ComputeToken is ERC20 {
    address public immutable factory;
    uint256 public immutable seriesId;

    constructor(string memory name_, string memory symbol_, uint256 seriesId_) ERC20(name_, symbol_) {
        factory = msg.sender;
        seriesId = seriesId_;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "only factory");
        _;
    }

    function mint(address to, uint256 amount) external onlyFactory {
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) external onlyFactory {
        _burn(from, amount);
    }
}
