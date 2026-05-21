// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OAppReceiver, Origin} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppReceiver.sol";
import {OAppCore} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppCore.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BridgeReceiver
 * @notice Deployed on Kite chain. Receives cross-chain USDC.e from Ethereum/Base/Avalanche
 *         via LayerZero V2 and credits the target AgentVault.
 */
contract BridgeReceiver is OAppReceiver {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    event FundsReceived(
        bytes32 indexed agentId,
        uint256 amount,
        uint32 srcEid,
        bytes32 guid
    );

    error InsufficientContractBalance(uint256 available, uint256 required);

    constructor(
        address _endpoint,
        address _owner,
        address _usdcToken
    ) OAppCore(_endpoint, _owner) Ownable(_owner) {
        usdcToken = IERC20(_usdcToken);
    }

    function _lzReceive(
        Origin calldata origin,
        bytes32 guid,
        bytes calldata message,
        address, /*executor*/
        bytes calldata /*extraData*/
    ) internal override {
        (address recipient, uint256 amount, bytes32 agentId) = abi.decode(
            message,
            (address, uint256, bytes32)
        );

        uint256 contractBalance = usdcToken.balanceOf(address(this));
        if (contractBalance < amount)
            revert InsufficientContractBalance(contractBalance, amount);

        usdcToken.safeTransfer(recipient, amount);
        emit FundsReceived(agentId, amount, origin.srcEid, guid);
    }

    function oAppVersion()
        public
        pure
        override
        returns (uint64 senderVersion, uint64 receiverVersion)
    {
        return (0, 2);
    }

    function withdrawEmergency(address token, address to, uint256 amount) external onlyOwner {
        SafeERC20.safeTransfer(IERC20(token), to, amount);
    }
}
