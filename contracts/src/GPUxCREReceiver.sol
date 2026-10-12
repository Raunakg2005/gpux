// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReceiverTemplate} from "./cre/ReceiverTemplate.sol";
import {DeliveryEscrow} from "./DeliveryEscrow.sol";
import {ComputeIndex} from "./ComputeIndex.sol";

/// @notice Entry point for Chainlink CRE reports. The CRE forwarder delivers DON-signed
/// reports here; this contract is the `oracle` of DeliveryEscrow and the `publisher` of
/// ComputeIndex, so only verified workflow output can settle deliveries or move the index.
///
/// Report encoding: abi.encode(uint8 action, bytes payload)
///   ACTION_SETTLE  -> payload = abi.encode(uint256 redemptionId, bool delivered)
///   ACTION_PUBLISH -> payload = abi.encode(bytes32[] keys, uint128[] prices)
contract GPUxCREReceiver is ReceiverTemplate {
    uint8 public constant ACTION_SETTLE = 1;
    uint8 public constant ACTION_PUBLISH = 2;

    DeliveryEscrow public immutable escrow;
    ComputeIndex public immutable index;

    event ReportProcessed(uint8 indexed action);

    error UnknownAction(uint8 action);

    constructor(address forwarder, DeliveryEscrow escrow_, ComputeIndex index_) ReceiverTemplate(forwarder) {
        escrow = escrow_;
        index = index_;
    }

    function _processReport(bytes calldata report) internal override {
        (uint8 action, bytes memory payload) = abi.decode(report, (uint8, bytes));
        if (action == ACTION_SETTLE) {
            (uint256 id, bool delivered) = abi.decode(payload, (uint256, bool));
            escrow.settle(id, delivered);
        } else if (action == ACTION_PUBLISH) {
            (bytes32[] memory keys, uint128[] memory prices) = abi.decode(payload, (bytes32[], uint128[]));
            for (uint256 i = 0; i < keys.length; i++) {
                index.publish(keys[i], prices[i]);
            }
        } else {
            revert UnknownAction(action);
        }
        emit ReportProcessed(action);
    }
}
