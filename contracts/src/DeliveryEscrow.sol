// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ComputeContractFactory} from "./ComputeContractFactory.sol";
import {SLABondVault} from "./SLABondVault.sol";
import {ProviderRegistry} from "./ProviderRegistry.sol";

/// @notice Buyers redeem compute tokens for delivery. A Chainlink CRE workflow (the
/// `oracle`) reports the outcome: delivered -> bond released, failed -> bond slashed to buyer.
contract DeliveryEscrow is Ownable {
    enum Status {
        None,
        Pending,
        Delivered,
        Failed
    }

    struct Redemption {
        uint256 seriesId;
        address buyer;
        uint256 amount;
        bytes accessCommitment; // sha256 of the access token the buyer sealed with their passkey (Mera PRF)
        Status status;
    }

    ComputeContractFactory public immutable factory;
    SLABondVault public immutable vault;
    ProviderRegistry public immutable registry;
    address public oracle;

    Redemption[] public redemptions;

    event RedemptionRequested(uint256 indexed id, uint256 indexed seriesId, address indexed buyer, uint256 amount);
    event DeliverySettled(uint256 indexed id, bool delivered, uint256 bondAmount);

    constructor(ComputeContractFactory f, SLABondVault v, ProviderRegistry r) Ownable(msg.sender) {
        factory = f;
        vault = v;
        registry = r;
    }

    function setOracle(address oracle_) external onlyOwner {
        oracle = oracle_;
    }

    function redeem(uint256 seriesId, uint256 amount, bytes calldata accessCommitment) external returns (uint256 id) {
        ComputeContractFactory.Series memory s = factory.series(seriesId);
        require(block.timestamp < s.deliveryEnd, "series expired");
        factory.burnForRedemption(seriesId, msg.sender, amount);
        id = redemptions.length;
        redemptions.push(Redemption(seriesId, msg.sender, amount, accessCommitment, Status.Pending));
        emit RedemptionRequested(id, seriesId, msg.sender, amount);
    }

    function settle(uint256 id, bool delivered) external {
        require(msg.sender == oracle, "only oracle");
        Redemption storage r = redemptions[id];
        require(r.status == Status.Pending, "not pending");
        ComputeContractFactory.Series memory s = factory.series(r.seriesId);
        uint256 bond = factory.bondFor(r.seriesId, r.amount);

        if (delivered) {
            r.status = Status.Delivered;
            vault.release(s.provider, r.seriesId, bond);
        } else {
            r.status = Status.Failed;
            vault.slash(s.provider, r.seriesId, bond, r.buyer);
        }
        registry.recordDelivery(s.provider, delivered);
        emit DeliverySettled(id, delivered, bond);
    }

    function redemptionCount() external view returns (uint256) {
        return redemptions.length;
    }
}
