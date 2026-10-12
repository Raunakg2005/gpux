// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice GPU providers and their delivery track record.
contract ProviderRegistry is Ownable {
    struct Provider {
        string name;
        string metadataURI;
        bool active;
        uint64 deliveriesOk;
        uint64 deliveriesFailed;
    }

    mapping(address => Provider) public providers;
    mapping(address => bool) public reporters; // DeliveryEscrow

    event ProviderRegistered(address indexed provider, string name);
    event DeliveryRecorded(address indexed provider, bool ok);

    constructor() Ownable(msg.sender) {}

    function setReporter(address reporter, bool allowed) external onlyOwner {
        reporters[reporter] = allowed;
    }

    function register(string calldata name, string calldata metadataURI) external {
        Provider storage p = providers[msg.sender];
        p.name = name;
        p.metadataURI = metadataURI;
        p.active = true;
        emit ProviderRegistered(msg.sender, name);
    }

    function setActive(address provider, bool active) external onlyOwner {
        providers[provider].active = active;
    }

    function recordDelivery(address provider, bool ok) external {
        require(reporters[msg.sender], "not reporter");
        if (ok) providers[provider].deliveriesOk++;
        else providers[provider].deliveriesFailed++;
        emit DeliveryRecorded(provider, ok);
    }

    function isActive(address provider) external view returns (bool) {
        return providers[provider].active;
    }

    /// @return score in basis points (10000 = perfect); 10000 for providers with no history.
    function reliabilityBps(address provider) external view returns (uint256) {
        Provider storage p = providers[provider];
        uint256 total = uint256(p.deliveriesOk) + p.deliveriesFailed;
        return total == 0 ? 10_000 : (uint256(p.deliveriesOk) * 10_000) / total;
    }
}
