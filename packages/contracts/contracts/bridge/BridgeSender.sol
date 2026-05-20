// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OAppSender, MessagingFee, MessagingReceipt} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import {OAppCore} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppCore.sol";
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BridgeSender
 * @notice Deployed on Ethereum/Base/Avalanche. Accepts USDC and forwards it to Kite chain
 *         via LayerZero V2. Recipient funds the target AgentVault.
 */
contract BridgeSender is OAppSender, Ownable {
    using SafeERC20 for IERC20;
    using OptionsBuilder for bytes;

    IERC20 public immutable usdcToken;
    uint32 public immutable dstEid; // Kite chain endpoint ID

    uint128 public constant GAS_LIMIT = 200_000;

    event BridgeInitiated(
        bytes32 indexed agentId,
        uint256 amount,
        uint32 dstChainId,
        bytes32 guid
    );

    constructor(
        address _endpoint,
        address _owner,
        address _usdcToken,
        uint32 _dstEid
    ) OAppCore(_endpoint, _owner) Ownable(_owner) {
        usdcToken = IERC20(_usdcToken);
        dstEid = _dstEid;
    }

    /**
     * @notice Quote the LayerZero fee for a bridge operation.
     */
    function quoteBridge(
        bytes32 agentId,
        uint256 amount,
        address recipient
    ) external view returns (MessagingFee memory fee) {
        bytes memory payload = abi.encode(recipient, amount, agentId);
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, 0);
        fee = _quote(dstEid, payload, options, false);
    }

    /**
     * @notice Bridge USDC to a recipient's AgentVault on Kite chain.
     * @dev Caller must approve this contract to spend `amount` of USDC.
     */
    function bridge(
        bytes32 agentId,
        uint256 amount,
        address recipient
    ) external payable returns (MessagingReceipt memory receipt) {
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        bytes memory payload = abi.encode(recipient, amount, agentId);
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, 0);
        MessagingFee memory fee = MessagingFee({nativeFee: msg.value, lzTokenFee: 0});

        receipt = _lzSend(dstEid, payload, options, fee, payable(msg.sender));
        emit BridgeInitiated(agentId, amount, dstEid, receipt.guid);
    }

    function oAppVersion()
        public
        pure
        override
        returns (uint64 senderVersion, uint64 receiverVersion)
    {
        return (2, 0);
    }

    receive() external payable {}
}
