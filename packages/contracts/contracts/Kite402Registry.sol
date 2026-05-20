// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Kite402Registry
 * @notice Central registry mapping operators to their agent fleet and agent IDs to vault addresses.
 */
contract Kite402Registry is Ownable {
    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    mapping(bytes32 => address) private _agentVaults;
    mapping(address => bytes32[]) private _operatorFleet;
    mapping(bytes32 => address) private _agentOperator;

    // approved registrars (the Kite402 API backend)
    mapping(address => bool) public registrars;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event AgentRegistered(bytes32 indexed agentId, address indexed vaultAddress, address indexed operator);
    event AgentDeregistered(bytes32 indexed agentId);
    event RegistrarAdded(address indexed registrar);
    event RegistrarRemoved(address indexed registrar);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error Unauthorized();
    error AgentAlreadyRegistered(bytes32 agentId);
    error AgentNotFound(bytes32 agentId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _owner) Ownable(_owner) {}

    // -------------------------------------------------------------------------
    // Registrar management
    // -------------------------------------------------------------------------

    function addRegistrar(address registrar) external onlyOwner {
        registrars[registrar] = true;
        emit RegistrarAdded(registrar);
    }

    function removeRegistrar(address registrar) external onlyOwner {
        registrars[registrar] = false;
        emit RegistrarRemoved(registrar);
    }

    // -------------------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------------------

    function registerAgent(
        bytes32 agentId,
        address vaultAddress,
        address operator
    ) external {
        if (!registrars[msg.sender] && msg.sender != owner())
            revert Unauthorized();
        if (_agentVaults[agentId] != address(0))
            revert AgentAlreadyRegistered(agentId);

        _agentVaults[agentId] = vaultAddress;
        _operatorFleet[operator].push(agentId);
        _agentOperator[agentId] = operator;

        emit AgentRegistered(agentId, vaultAddress, operator);
    }

    function deregisterAgent(bytes32 agentId) external onlyOwner {
        if (_agentVaults[agentId] == address(0)) revert AgentNotFound(agentId);

        address operator = _agentOperator[agentId];
        bytes32[] storage fleet = _operatorFleet[operator];
        for (uint256 i = 0; i < fleet.length; i++) {
            if (fleet[i] == agentId) {
                fleet[i] = fleet[fleet.length - 1];
                fleet.pop();
                break;
            }
        }

        delete _agentVaults[agentId];
        delete _agentOperator[agentId];
        emit AgentDeregistered(agentId);
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    function getAgentVault(bytes32 agentId) external view returns (address) {
        return _agentVaults[agentId];
    }

    function getFleet(address operator) external view returns (bytes32[] memory) {
        return _operatorFleet[operator];
    }

    function getAgentOperator(bytes32 agentId) external view returns (address) {
        return _agentOperator[agentId];
    }
}
