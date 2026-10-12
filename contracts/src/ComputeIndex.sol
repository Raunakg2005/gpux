// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Onchain compute price index (AUSD per GPU-hour, 6 decimals), published by CRE
/// from Kuru fill TWAPs. Keyed by keccak256(abi.encode(gpuType, region)).
contract ComputeIndex is Ownable {
    struct Point {
        uint128 price;
        uint64 timestamp;
    }

    address public publisher;
    mapping(bytes32 => Point) public latest;
    mapping(bytes32 => Point[]) internal _history;

    event IndexUpdated(bytes32 indexed key, uint128 price, uint64 timestamp);

    constructor() Ownable(msg.sender) {}

    function setPublisher(address p) external onlyOwner {
        publisher = p;
    }

    function keyOf(string calldata gpuType, string calldata region) external pure returns (bytes32) {
        return keccak256(abi.encode(gpuType, region));
    }

    function publish(bytes32 key, uint128 price) external {
        require(msg.sender == publisher, "only publisher");
        Point memory p = Point(price, uint64(block.timestamp));
        latest[key] = p;
        _history[key].push(p);
        emit IndexUpdated(key, price, p.timestamp);
    }

    function historyLength(bytes32 key) external view returns (uint256) {
        return _history[key].length;
    }

    function historyAt(bytes32 key, uint256 i) external view returns (Point memory) {
        return _history[key][i];
    }
}
