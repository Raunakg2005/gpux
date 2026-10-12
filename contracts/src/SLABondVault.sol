// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Holds provider performance bonds in AUSD. Bonds are locked per series when
/// capacity is minted, released on delivery, and slashed to buyers on failure.
contract SLABondVault is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable ausd;
    mapping(address => uint256) public freeBond;
    mapping(address => mapping(uint256 => uint256)) public lockedBond; // provider => seriesId => amount
    mapping(address => bool) public managers; // factory + escrow

    event Deposited(address indexed provider, uint256 amount);
    event Withdrawn(address indexed provider, uint256 amount);
    event Locked(address indexed provider, uint256 indexed seriesId, uint256 amount);
    event Released(address indexed provider, uint256 indexed seriesId, uint256 amount);
    event Slashed(address indexed provider, uint256 indexed seriesId, address indexed to, uint256 amount);

    constructor(IERC20 ausd_) Ownable(msg.sender) {
        ausd = ausd_;
    }

    modifier onlyManager() {
        require(managers[msg.sender], "not manager");
        _;
    }

    function setManager(address m, bool allowed) external onlyOwner {
        managers[m] = allowed;
    }

    function deposit(uint256 amount) external {
        ausd.safeTransferFrom(msg.sender, address(this), amount);
        freeBond[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        freeBond[msg.sender] -= amount;
        ausd.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function lock(address provider, uint256 seriesId, uint256 amount) external onlyManager {
        require(freeBond[provider] >= amount, "insufficient bond");
        freeBond[provider] -= amount;
        lockedBond[provider][seriesId] += amount;
        emit Locked(provider, seriesId, amount);
    }

    function release(address provider, uint256 seriesId, uint256 amount) external onlyManager {
        lockedBond[provider][seriesId] -= amount;
        freeBond[provider] += amount;
        emit Released(provider, seriesId, amount);
    }

    function slash(address provider, uint256 seriesId, uint256 amount, address to) external onlyManager {
        lockedBond[provider][seriesId] -= amount;
        ausd.safeTransfer(to, amount);
        emit Slashed(provider, seriesId, to, amount);
    }
}
